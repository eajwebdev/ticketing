<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\ClientSystem;
use App\Models\Expense;
use App\Models\Subscription;
use App\Models\SystemType;
use App\Models\User;
use App\Notifications\SubscriptionExpiryNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Company domains / hosting / VPS: CRUD, renewals, Client Systems link and expiry emails. */
class SubscriptionTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $pm;

    private User $client;

    private ClientSystem $system;

    protected function setUp(): void
    {
        parent::setUp();
        config(['broadcasting.default' => 'null']);
        Carbon::setTestNow('2026-03-01 09:00:00');

        $this->owner = User::factory()->create(['role' => Role::Admin, 'approval_status' => 'approved']);
        $this->pm = User::factory()->create(['role' => Role::Manager, 'approval_status' => 'approved']);
        $this->client = User::factory()->create(['role' => Role::Customer, 'store_name' => 'Juan Laundry', 'approval_status' => 'approved']);
        $type = SystemType::create(['name' => 'Laundry Management System', 'is_active' => true]);
        $this->system = ClientSystem::create([
            'client_id' => $this->client->id, 'system_type_id' => $type->id, 'amount' => 1500,
            'billing_cycle' => 'monthly', 'next_due_date' => '2026-03-20',
            'login_url' => 'https://www.JuanLaundry.com/login',
        ]);
        Sanctum::actingAs($this->owner);
    }

    private function make(array $attrs = []): Subscription
    {
        return Subscription::create([
            'type' => 'domain', 'name' => 'juanlaundry.com', 'billing_cycle' => 'yearly',
            'expires_on' => '2026-06-01', 'cost' => 900, ...$attrs,
        ]);
    }

    public function test_client_system_domains_are_suggested_until_tracked(): void
    {
        $this->getJson('/api/v1/admin/subscriptions')->assertOk()
            ->assertJsonPath('suggestions.0.domain', 'juanlaundry.com')
            ->assertJsonPath('suggestions.0.client_system_id', $this->system->id);

        $this->postJson('/api/v1/admin/subscriptions', [
            'type' => 'domain', 'name' => 'https://www.JuanLaundry.com/', 'client_system_id' => $this->system->id,
            'paid_by' => 'company', 'billing_cycle' => 'yearly', 'expires_on' => '2026-04-15', 'cost' => 900,
        ])->assertCreated()
            ->assertJsonPath('data.name', 'juanlaundry.com')      // stored bare
            ->assertJsonPath('data.client.id', $this->client->id) // client taken from the system
            ->assertJsonPath('data.state', 'active');

        $this->getJson('/api/v1/admin/subscriptions')->assertJsonCount(0, 'suggestions');
    }

    public function test_project_manager_can_manage_but_developer_cannot(): void
    {
        Sanctum::actingAs($this->pm);
        $this->getJson('/api/v1/admin/subscriptions')->assertOk();

        Sanctum::actingAs(User::factory()->create(['role' => Role::Developer, 'approval_status' => 'approved']));
        $this->getJson('/api/v1/admin/subscriptions')->assertForbidden();
    }

    public function test_renew_moves_expiry_one_cycle_and_can_log_an_expense(): void
    {
        $sub = $this->make(['provider' => 'Namecheap', 'last_alert_stage' => 7, 'last_alerted_on' => '2026-02-28']);

        $this->postJson("/api/v1/admin/subscriptions/{$sub->id}/renew", ['record_expense' => true, 'method' => 'gcash'])
            ->assertOk()->assertJsonPath('data.expires_on', '2027-06-01');

        $sub->refresh();
        $this->assertNull($sub->last_alert_stage); // alert ladder starts over
        $expense = Expense::sole();
        $this->assertSame('Hosting & Domains', $expense->category);
        $this->assertEquals(900, $expense->amount);
        $this->assertSame('Namecheap', $expense->payee);
    }

    public function test_alerts_owner_admin_by_email_at_each_stage_then_daily_when_expired(): void
    {
        Notification::fake();
        $dev = User::factory()->create(['role' => Role::Developer, 'approval_status' => 'approved']);
        $sub = $this->make(['expires_on' => '2026-03-31']); // 30 days out

        $run = function (string $now) {
            Carbon::setTestNow($now);
            $this->artisan('subscriptions:remind')->assertSuccessful();
        };
        $countFor = fn (User $u) => Notification::sent($u, SubscriptionExpiryNotification::class)->count();

        $run('2026-03-01 09:00');            // 30 days → alert
        $this->assertSame(1, $countFor($this->owner));
        $this->assertSame(0, $countFor($this->pm));   // only the Owner/Admin role is emailed
        $this->assertSame(0, $countFor($dev));
        Notification::assertSentTo($this->owner, SubscriptionExpiryNotification::class,
            fn ($n, $channels) => in_array('mail', $channels) && $n->type === 'subscription_expiring');

        $run('2026-03-01 15:00');            // same day → nothing new
        $run('2026-03-10 09:00');            // 21 days → still in 30-day stage, nothing
        $this->assertSame(1, $countFor($this->owner));

        $run('2026-03-20 09:00');            // 11 days → 14-day stage (missed day 14 is caught up)
        $this->assertSame(2, $countFor($this->owner));

        $run('2026-03-31 09:00');            // expiry day
        $run('2026-04-01 09:00');            // expired → daily
        $run('2026-04-02 09:00');
        $this->assertSame(5, $countFor($this->owner));
        Notification::assertSentTo($this->owner, SubscriptionExpiryNotification::class,
            fn ($n) => $n->type === 'subscription_expired');

        $sub->update(['status' => 'cancelled']);
        $run('2026-04-03 09:00');            // cancelled → silent
        $this->assertSame(5, $countFor($this->owner));
        $this->assertSame(0, $countFor($this->pm));
    }

    public function test_expiry_email_renders(): void
    {
        $sub = $this->make(['expires_on' => '2026-03-08', 'provider' => 'Namecheap', 'client_system_id' => $this->system->id]);
        $mail = (new SubscriptionExpiryNotification('subscription_expiring', $sub))->toMail($this->owner);

        $this->assertSame('Expires in 7 days: juanlaundry.com (Domain)', $mail->subject);
        $this->assertStringContainsString('Juan Laundry', implode(' ', $mail->introLines));
    }
}
