<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\ClientSystem;
use App\Models\SystemPayment;
use App\Models\SystemType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** One-time setup fee + monthly subscription, on client systems and on leads. */
class SetupFeeTest extends TestCase
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
        Sanctum::actingAs($this->admin);
    }

    private function createSystem(array $attrs = []): int
    {
        return $this->postJson('/api/v1/admin/client-systems', [
            'client_id' => $this->client->id,
            'system_type_id' => $this->type->id,
            'amount' => 1500,
            'setup_fee' => 10000,
            'billing_cycle' => 'monthly',
            'next_due_date' => '2026-02-20',
            ...$attrs,
        ])->assertCreated()
            ->assertJsonPath('data.setup_fee', 10000)
            ->assertJsonPath('data.setup_state', 'unpaid')
            ->json('data.id');
    }

    public function test_setup_fee_is_paid_separately_without_moving_the_due_date(): void
    {
        $id = $this->createSystem();

        $this->getJson('/api/v1/admin/billing/overview')
            ->assertJsonPath('setup_unpaid', 1)
            ->assertJsonPath('setup_unpaid_amount', 10000);

        $this->postJson("/api/v1/admin/client-systems/{$id}/pay-setup", [
            'amount' => 10000, 'paid_at' => '2026-01-20', 'method' => 'gcash',
        ])->assertCreated()
            ->assertJsonPath('payment.kind', 'setup')
            ->assertJsonPath('system.setup_state', 'paid')
            ->assertJsonPath('system.setup_paid_at', '2026-01-20')
            ->assertJsonPath('system.next_due_date', '2026-02-20'); // subscription untouched

        // Can't pay it twice.
        $this->postJson("/api/v1/admin/client-systems/{$id}/pay-setup", [
            'amount' => 10000, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->assertStatus(422);

        // Then the first monthly payment moves the due date as usual.
        $this->postJson("/api/v1/admin/client-systems/{$id}/pay", [
            'amount' => 1500, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->assertCreated()->assertJsonPath('system.next_due_date', '2026-03-20');

        $this->getJson('/api/v1/admin/sales?from=2026-01-01&to=2026-12-31')
            ->assertJsonPath('summary.range_total', 11500)
            ->assertJsonPath('summary.range_setup', 10000)
            ->assertJsonPath('summary.range_setup_count', 1);

        $this->getJson('/api/v1/dashboard')
            ->assertJsonPath('finance.setup_revenue', 10000)
            ->assertJsonPath('finance.receivables.setup_unpaid_count', 0);
    }

    public function test_voiding_setup_payment_marks_it_unpaid_and_keeps_due_date(): void
    {
        $id = $this->createSystem();
        $setup = $this->postJson("/api/v1/admin/client-systems/{$id}/pay-setup", [
            'amount' => 10000, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->json('payment.id');
        $this->postJson("/api/v1/admin/client-systems/{$id}/pay", [
            'amount' => 1500, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->assertCreated();

        $this->deleteJson("/api/v1/admin/sales/{$setup}")->assertNoContent();

        $system = ClientSystem::find($id);
        $this->assertNull($system->setup_paid_at);
        $this->assertSame('2026-03-20', $system->next_due_date->toDateString());
        $this->assertSame(1, SystemPayment::count());
    }

    public function test_voiding_subscription_payment_ignores_later_setup_payment(): void
    {
        $id = $this->createSystem();
        $sub = $this->postJson("/api/v1/admin/client-systems/{$id}/pay", [
            'amount' => 1500, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->json('payment.id');
        $this->postJson("/api/v1/admin/client-systems/{$id}/pay-setup", [
            'amount' => 10000, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->assertCreated();

        $this->deleteJson("/api/v1/admin/sales/{$sub}")->assertNoContent();

        $this->assertSame('2026-02-20', ClientSystem::find($id)->next_due_date->toDateString());
    }

    public function test_system_without_setup_fee_cannot_record_one(): void
    {
        $id = $this->postJson('/api/v1/admin/client-systems', [
            'client_id' => $this->client->id, 'system_type_id' => $this->type->id,
            'amount' => 1500, 'billing_cycle' => 'monthly', 'next_due_date' => '2026-02-20',
        ])->assertCreated()->assertJsonPath('data.setup_state', 'none')->json('data.id');

        $this->postJson("/api/v1/admin/client-systems/{$id}/pay-setup", [
            'amount' => 100, 'paid_at' => '2026-01-20', 'method' => 'cash',
        ])->assertStatus(422);
    }

    public function test_existing_system_can_be_edited_to_setup_already_paid_without_a_sale(): void
    {
        // An older system added before setup fees were tracked.
        $id = $this->postJson('/api/v1/admin/client-systems', [
            'client_id' => $this->client->id, 'system_type_id' => $this->type->id,
            'amount' => 1500, 'billing_cycle' => 'monthly', 'next_due_date' => '2026-02-20',
        ])->assertCreated()->json('data.id');

        $payload = [
            'client_id' => $this->client->id, 'system_type_id' => $this->type->id,
            'amount' => 1500, 'billing_cycle' => 'monthly', 'next_due_date' => '2026-02-20',
            'setup_fee' => 8000, 'setup_paid_at' => '2025-06-01',
        ];
        $this->patchJson("/api/v1/admin/client-systems/{$id}", $payload)->assertOk()
            ->assertJsonPath('data.setup_fee', 8000)
            ->assertJsonPath('data.setup_state', 'paid')
            ->assertJsonPath('data.setup_paid_at', '2025-06-01')
            ->assertJsonPath('data.setup_recorded', false);
        $this->assertSame(0, SystemPayment::count()); // no sale added

        // Untick "already paid" → unpaid again; can't set a future date.
        $this->patchJson("/api/v1/admin/client-systems/{$id}", [...$payload, 'setup_paid_at' => null])
            ->assertOk()->assertJsonPath('data.setup_state', 'unpaid');
        $this->patchJson("/api/v1/admin/client-systems/{$id}", [...$payload, 'setup_paid_at' => '2026-12-01'])
            ->assertUnprocessable();

        // Removing the fee clears the paid date.
        $this->patchJson("/api/v1/admin/client-systems/{$id}", [...$payload, 'setup_fee' => null])
            ->assertOk()->assertJsonPath('data.setup_state', 'none')->assertJsonPath('data.setup_paid_at', null);
    }

    public function test_setup_paid_date_from_a_recorded_sale_is_not_overwritten_by_edit(): void
    {
        $id = $this->createSystem();
        $this->postJson("/api/v1/admin/client-systems/{$id}/pay-setup", [
            'amount' => 10000, 'paid_at' => '2026-01-15', 'method' => 'cash',
        ])->assertCreated();

        $this->patchJson("/api/v1/admin/client-systems/{$id}", [
            'client_id' => $this->client->id, 'system_type_id' => $this->type->id,
            'amount' => 1500, 'billing_cycle' => 'monthly', 'next_due_date' => '2026-02-20',
            'setup_fee' => 10000, 'setup_paid_at' => null,
        ])->assertOk()
            ->assertJsonPath('data.setup_paid_at', '2026-01-15')
            ->assertJsonPath('data.setup_recorded', true);
    }

    public function test_lead_tracks_setup_and_monthly_fee(): void
    {
        $this->postJson('/api/v1/leads', [
            'business_name' => 'AC Villa', 'estimated_value' => 10000, 'monthly_fee' => 1500, 'stage' => 'demo',
        ])->assertCreated()
            ->assertJsonPath('data.estimated_value', 10000)
            ->assertJsonPath('data.monthly_fee', 1500);

        $this->getJson('/api/v1/leads')
            ->assertJsonPath('summary.pipeline_value', 10000)
            ->assertJsonPath('summary.pipeline_monthly', 1500);
    }
}
