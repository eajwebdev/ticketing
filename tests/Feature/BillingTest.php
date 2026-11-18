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

    public function test_yearly_lock_in_shows_discount_and_records_it_on_payment(): void
    {
        Sanctum::actingAs($this->admin);

        // ₱1,500/mo regular → ₱18,000/yr; locked in at ₱15,000 (2 months free).
        $res = $this->postJson('/api/v1/admin/client-systems', [
            'client_id' => $this->client->id,
            'system_type_id' => $this->type->id,
            'amount' => 15000,
            'regular_monthly_rate' => 1500,
            'billing_cycle' => 'yearly',
            'next_due_date' => '2026-01-31',
        ])->assertCreated();

        $res->assertJsonPath('data.regular_cycle_amount', 18000)
            ->assertJsonPath('data.discount_amount', 3000)
            ->assertJsonPath('data.discount_percent', 16.7);

        $id = $res->json('data.id');

        $pay = $this->postJson("/api/v1/admin/client-systems/{$id}/pay", [
            'amount' => 15000, 'paid_at' => '2026-01-20', 'method' => 'gcash',
        ])->assertCreated();

        $pay->assertJsonPath('payment.discount_amount', 3000)
            ->assertJsonPath('system.next_due_date', '2027-01-31'); // rolled forward one year

        $this->getJson('/api/v1/admin/sales?from=2026-01-01&to=2026-12-31')
            ->assertOk()
            ->assertJsonPath('summary.range_total', 15000)
            ->assertJsonPath('summary.range_discounts', 3000);

        // Switching to monthly drops the regular rate (no lock-in discount on monthly plans).
        $this->patchJson("/api/v1/admin/client-systems/{$id}", [
            'client_id' => $this->client->id, 'system_type_id' => $this->type->id,
            'amount' => 1500, 'regular_monthly_rate' => 1500, 'billing_cycle' => 'monthly',
            'next_due_date' => '2027-01-31',
        ])->assertOk()
            ->assertJsonPath('data.regular_monthly_rate', null)
            ->assertJsonPath('data.discount_amount', 0);
    }

    public function test_advance_payment_covers_several_cycles_and_void_restores_due_date(): void
    {
        Sanctum::actingAs($this->admin);
        $system = $this->system(['regular_monthly_rate' => null]); // ₱1,500 monthly, due Jan 31

        // Pays 3 months at once: Jan 31 → Apr 30 (anchor day 31, April has 30 days).
        $pay = $this->postJson("/api/v1/admin/client-systems/{$system->id}/pay", [
            'amount' => 4500, 'cycles' => 3, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->assertCreated()
            ->assertJsonPath('payment.cycles', 3)
            ->assertJsonPath('payment.covered_due_date', '2026-01-31')
            ->assertJsonPath('system.next_due_date', '2026-04-30');

        // Next single payment keeps the anchor: Apr 30 → May 31.
        $this->postJson("/api/v1/admin/client-systems/{$system->id}/pay", [
            'amount' => 1500, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->assertCreated()->assertJsonPath('system.next_due_date', '2026-05-31');

        // Voiding the latest payment puts the due date back.
        $latest = SystemPayment::latest('id')->first();
        $this->deleteJson("/api/v1/admin/sales/{$latest->id}")->assertNoContent();
        $this->assertSame('2026-04-30', $system->fresh()->next_due_date->toDateString());

        $this->postJson("/api/v1/admin/client-systems/{$system->id}/pay", [
            'amount' => 1, 'cycles' => 25, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->assertUnprocessable()->assertJsonValidationErrors('cycles');

        $this->assertSame((int) $pay->json('payment.id'), (int) SystemPayment::first()->id);
    }

    public function test_started_on_defaults_to_first_due_date_and_is_kept_on_edit(): void
    {
        Sanctum::actingAs($this->admin);

        $base = [
            'client_id' => $this->client->id, 'system_type_id' => $this->type->id,
            'amount' => 1500, 'billing_cycle' => 'monthly', 'next_due_date' => '2026-02-15',
        ];
        $id = $this->postJson('/api/v1/admin/client-systems', $base)
            ->assertCreated()->assertJsonPath('data.started_on', '2026-02-15')->json('data.id');

        $this->patchJson("/api/v1/admin/client-systems/{$id}", [...$base, 'started_on' => '2024-06-01'])
            ->assertOk()->assertJsonPath('data.started_on', '2024-06-01');

        // Editing without a start date keeps the saved one.
        $this->patchJson("/api/v1/admin/client-systems/{$id}", [...$base, 'next_due_date' => '2026-03-15'])
            ->assertOk()->assertJsonPath('data.started_on', '2024-06-01');
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

    public function test_client_system_can_have_its_own_exact_name(): void
    {
        Sanctum::actingAs($this->admin);
        $base = [
            'client_id' => $this->client->id, 'system_type_id' => $this->type->id,
            'amount' => 1500, 'billing_cycle' => 'monthly', 'next_due_date' => '2026-02-15',
        ];

        $id = $this->postJson('/api/v1/admin/client-systems', [...$base, 'system_name' => "Juan's LaundryPro", 'label' => 'Main branch'])
            ->assertCreated()
            ->assertJsonPath('data.system_name', "Juan's LaundryPro")
            ->assertJsonPath('data.display_name', "Juan's LaundryPro (Main branch)")
            ->json('data.id');

        $this->getJson('/api/v1/admin/client-systems?search=laundrypro')
            ->assertOk()->assertJsonPath('data.0.id', $id);

        // Blank name falls back to the system type.
        $this->patchJson("/api/v1/admin/client-systems/{$id}", [...$base, 'system_name' => '', 'label' => null])
            ->assertOk()->assertJsonPath('data.display_name', 'Laundry Management System');
    }
}
