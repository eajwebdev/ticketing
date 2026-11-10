<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\ClientSystem;
use App\Models\SystemPayment;
use App\Models\SystemType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $client;

    private SystemType $type;

    protected function setUp(): void
    {
        parent::setUp();
        config(['broadcasting.default' => 'null']);
        Carbon::setTestNow('2026-01-20 09:00:00');

        $this->admin = User::factory()->create(['role' => Role::Admin, 'approval_status' => 'approved']);
        $this->client = User::factory()->create(['role' => Role::Customer, 'store_name' => 'Juan Laundry', 'approval_status' => 'approved']);
        $this->type = SystemType::create(['name' => 'Laundry Management System', 'is_active' => true]);
    }

    private function system(array $attrs = []): ClientSystem
    {
        return ClientSystem::create([
            'client_id' => $this->client->id,
            'system_type_id' => $this->type->id,
            'amount' => 1500,
            'billing_cycle' => 'monthly',
            'next_due_date' => '2026-01-31',
            'username' => 'juan_admin',
            'password' => 's3cret!',
            ...$attrs,
        ]);
    }

    public function test_admin_creates_system_with_encrypted_credentials(): void
    {
        Sanctum::actingAs($this->admin);

        $res = $this->postJson('/api/v1/admin/client-systems', [
            'client_id' => $this->client->id,
            'system_type_id' => $this->type->id,
            'amount' => 2500,
            'billing_cycle' => 'monthly',
            'next_due_date' => '2026-02-15',
            'username' => 'owner',
            'password' => 'hunter2',
        ])->assertCreated()->assertJsonPath('data.has_credentials', true);

        $this->assertArrayNotHasKey('password', $res->json('data'));
        $raw = DB::table('client_systems')->first();
        $this->assertNotSame('hunter2', $raw->password);
        $this->assertSame('hunter2', ClientSystem::first()->password);
        $this->assertSame(15, (int) $raw->billing_anchor_day);
    }

    public function test_marking_paid_records_sale_and_keeps_anchor_day(): void
    {
        Sanctum::actingAs($this->admin);
        $system = $this->system();

        $pay = fn () => $this->postJson("/api/v1/admin/client-systems/{$system->id}/pay", [
            'amount' => 1500, 'paid_at' => '2026-01-20', 'method' => 'gcash', 'reference' => 'GC-1',
        ])->assertCreated();

        $pay()->assertJsonPath('payment.covered_due_date', '2026-01-31')
            ->assertJsonPath('system.next_due_date', '2026-02-28');
        // Feb 28 → back to the 31st in March, not stuck on the 28th.
        $pay()->assertJsonPath('system.next_due_date', '2026-03-31');

        $this->assertSame(2, SystemPayment::count());
        $this->getJson('/api/v1/admin/sales')
            ->assertOk()
            ->assertJsonPath('summary.this_month', 3000)
            ->assertJsonPath('by_system.0.name', 'Laundry Management System');
    }

    public function test_yearly_cycle_and_void_restores_due_date(): void
    {
        Sanctum::actingAs($this->admin);
        $system = $this->system(['billing_cycle' => 'yearly', 'next_due_date' => '2026-03-10']);

        $paymentId = $this->postJson("/api/v1/admin/client-systems/{$system->id}/pay", [
            'amount' => 18000, 'paid_at' => '2026-01-20', 'method' => 'bank_transfer',
        ])->assertJsonPath('system.next_due_date', '2027-03-10')->json('payment.id');

        $this->deleteJson("/api/v1/admin/sales/{$paymentId}")->assertNoContent();
        $this->assertSame('2026-03-10', $system->fresh()->next_due_date->toDateString());
        $this->assertSame(0, SystemPayment::count());
    }

    public function test_cannot_delete_system_with_sales(): void
    {
        Sanctum::actingAs($this->admin);
        $system = $this->system();
        $this->postJson("/api/v1/admin/client-systems/{$system->id}/pay", ['amount' => 1, 'paid_at' => '2026-01-20', 'method' => 'cash']);

        $this->deleteJson("/api/v1/admin/client-systems/{$system->id}")->assertStatus(422);
    }

    public function test_blank_password_on_edit_keeps_existing(): void
    {
        Sanctum::actingAs($this->admin);
        $system = $this->system();

        $this->patchJson("/api/v1/admin/client-systems/{$system->id}", [
            'client_id' => $this->client->id, 'system_type_id' => $this->type->id, 'amount' => 1800,
            'billing_cycle' => 'monthly', 'next_due_date' => '2026-01-31', 'username' => 'juan_admin', 'password' => '',
        ])->assertOk();

        $this->assertSame('s3cret!', $system->fresh()->password);
        $this->assertSame('1800.00', $system->fresh()->amount);
    }

    public function test_credentials_access_is_permission_gated(): void
    {
        $system = $this->system();
        $agent = User::factory()->create(['role' => Role::Support]);
        $url = "/api/v1/admin/client-systems/{$system->id}/credentials";

        Sanctum::actingAs($this->client);
        $this->getJson($url)->assertForbidden();
        $this->getJson('/api/v1/admin/client-systems')->assertForbidden();

        Sanctum::actingAs($agent);
        $this->getJson($url)->assertForbidden();

        $agent->update(['permissions' => [...Role::Support->defaultPermissions(), 'credentials.view']]);
        $this->getJson($url)->assertOk()->assertJson(['username' => 'juan_admin', 'password' => 's3cret!']);
        // Staff see the list but not the money.
        $this->getJson('/api/v1/admin/client-systems')->assertOk()->assertJsonMissingPath('data.0.amount');
        $this->postJson("/api/v1/admin/client-systems/{$system->id}/pay", [])->assertForbidden();

        Sanctum::actingAs($this->admin);
        $this->getJson($url)->assertOk();
    }

    public function test_admin_can_grant_credential_access_from_users(): void
    {
        Sanctum::actingAs($this->admin);
        $dev = User::factory()->create(['role' => Role::Developer]);

        $this->patchJson("/api/v1/admin/users/{$dev->id}", [
            'permissions' => ['tickets.handle', 'systems.view', 'credentials.view'],
        ])->assertOk()->assertJsonPath('data.has_custom_permissions', true);
        $this->assertTrue($dev->fresh()->canViewCredentials());
    }

    public function test_reminders_fire_on_7_3_0_days_and_daily_when_overdue(): void
    {
        $in7 = $this->system(['next_due_date' => '2026-01-27']);
        $in5 = $this->system(['next_due_date' => '2026-01-25']);
        $in3 = $this->system(['next_due_date' => '2026-01-23']);
        $today = $this->system(['next_due_date' => '2026-01-20']);
        $late = $this->system(['next_due_date' => '2026-01-10']);
        $paused = $this->system(['next_due_date' => '2026-01-10', 'status' => 'paused']);

        $this->artisan('billing:remind')->assertSuccessful();

        $types = $this->admin->notifications()->get()->pluck('data.type', 'data.client_system_id');
        $this->assertSame('billing_due', $types[$in7->id]);
        $this->assertSame('billing_due', $types[$in3->id]);
        $this->assertSame('billing_due_today', $types[$today->id]);
        $this->assertSame('billing_overdue', $types[$late->id]);
        $this->assertArrayNotHasKey($in5->id, $types->all());
        $this->assertArrayNotHasKey($paused->id, $types->all());
        $this->assertStringContainsString('OVERDUE by 10 days', $this->admin->notifications()->get()
            ->firstWhere('data.client_system_id', $late->id)->data['message']);

        // Running again the same day doesn't spam…
        $this->artisan('billing:remind');
        $this->assertSame(4, $this->admin->notifications()->count());

        // …but overdue nags again the next day.
        Carbon::setTestNow('2026-01-21 09:00:00');
        $this->artisan('billing:remind');
        $this->assertSame(2, $this->admin->notifications()->where('data->client_system_id', $late->id)->count());
    }
    public function test_client_with_multiple_systems_picks_one_when_filing_a_ticket(): void
    {
        $pharmacy = SystemType::create(['name' => 'Pharmacy Management System', 'is_active' => true]);
        $laundryMain = $this->system(['label' => 'Main branch']);
        $laundry2 = $this->system(['label' => 'Branch 2']);
        $pharma = $this->system(['system_type_id' => $pharmacy->id]);
        $this->system(['label' => 'Old', 'status' => 'cancelled']);
        $other = User::factory()->create(['role' => Role::Customer]);
        $othersSystem = $this->system(['client_id' => $other->id]);

        Sanctum::actingAs($this->client);

        // Only their own, non-cancelled systems are offered — no billing data.
        $list = $this->getJson('/api/v1/ticket-systems')->assertOk()->json('data');
        $this->assertEqualsCanonicalizing([$laundryMain->id, $laundry2->id, $pharma->id], array_column($list, 'id'));
        $this->assertArrayNotHasKey('amount', $list[0]);

        $ticket = ['subject' => 'POS frozen', 'description' => 'Cannot print receipts'];
        $this->postJson('/api/v1/tickets', $ticket)->assertStatus(422)->assertJsonValidationErrors('client_system_id');
        $this->postJson('/api/v1/tickets', [...$ticket, 'client_system_id' => $othersSystem->id])
            ->assertStatus(422)->assertJsonValidationErrors('client_system_id');

        $this->postJson('/api/v1/tickets', [...$ticket, 'client_system_id' => $laundry2->id, 'system_type_id' => $pharmacy->id])
            ->assertCreated()
            ->assertJsonPath('data.client_system.label', 'Branch 2')
            ->assertJsonPath('data.system_type.id', $this->type->id); // type comes from the chosen system

        // Admin filing on the client's behalf sees and uses that client's systems.
        Sanctum::actingAs($this->admin);
        $this->assertCount(3, $this->getJson("/api/v1/ticket-systems?customer_id={$this->client->id}")->json('data'));
        $this->postJson('/api/v1/tickets', [...$ticket, 'customer_id' => $this->client->id, 'client_system_id' => $pharma->id])
            ->assertCreated()->assertJsonPath('data.system_type.id', $pharmacy->id);
    }

    public function test_client_without_registered_systems_can_still_pick_a_system_type(): void
    {
        $newClient = User::factory()->create(['role' => Role::Customer, 'approval_status' => 'approved']);
        Sanctum::actingAs($newClient);

        $this->getJson('/api/v1/ticket-systems')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/v1/tickets', [
            'subject' => 'Inquiry', 'description' => 'How much?', 'system_type_id' => $this->type->id,
        ])->assertCreated()->assertJsonPath('data.system_type.id', $this->type->id);
    }
}
