<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\ClientSystem;
use App\Models\Expense;
use App\Models\SystemPayment;
use App\Models\SystemType;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        config(['broadcasting.default' => 'null']);
        Carbon::setTestNow('2026-03-20 10:00:00');
        $this->admin = User::factory()->create(['role' => Role::Admin, 'approval_status' => 'approved']);
    }

    private function seedMoney(): void
    {
        $client = User::factory()->create(['role' => Role::Customer, 'store_name' => 'Juan Laundry', 'approval_status' => 'approved']);
        $type = SystemType::create(['name' => 'Laundry Management System', 'is_active' => true]);
        $system = ClientSystem::create([
            'client_id' => $client->id, 'system_type_id' => $type->id, 'amount' => 1500,
            'billing_cycle' => 'monthly', 'next_due_date' => '2026-03-10', // overdue
        ]);
        foreach ([['2026-03-05', 1500], ['2026-02-05', 1500], ['2026-01-05', 1000]] as [$paid, $amt]) {
            SystemPayment::create([
                'client_system_id' => $system->id, 'client_id' => $client->id, 'system_type_id' => $type->id,
                'amount' => $amt, 'cycles' => 1, 'paid_at' => $paid, 'method' => 'cash',
                'covered_due_date' => $paid, 'next_due_date' => $paid, 'recorded_by' => $this->admin->id,
            ]);
        }
        Expense::create(['spent_on' => '2026-03-02', 'category' => 'Hosting & Domains', 'description' => 'VPS', 'amount' => 400]);
        Expense::create(['spent_on' => '2026-02-02', 'category' => 'Hosting & Domains', 'description' => 'VPS', 'amount' => 400]);
    }

    public function test_admin_gets_all_sections_with_profit_and_attention(): void
    {
        $this->seedMoney();
        Task::create(['title' => 'Fix report', 'status' => 'todo', 'priority' => 'high', 'assignee_id' => $this->admin->id,
            'created_by' => $this->admin->id, 'due_date' => '2026-03-18']);
        Sanctum::actingAs($this->admin);

        $res = $this->getJson('/api/v1/dashboard')->assertOk();

        $res->assertJsonPath('sections', ['overview', 'finance', 'expenses', 'support', 'work'])
            ->assertJsonPath('finance.month.revenue', 1500)
            ->assertJsonPath('finance.month.expenses', 400)
            ->assertJsonPath('finance.month.net', 1100)
            ->assertJsonPath('finance.receivables.overdue_count', 1)
            ->assertJsonPath('work.tasks.overdue', 1)
            ->assertJsonCount(6, 'finance.trend');

        $trend = collect($res->json('finance.trend'))->keyBy('month');
        $this->assertSame(1500.0, (float) $trend['2026-02']['revenue']);
        $this->assertSame(1100.0, (float) $trend['2026-02']['net']);

        $kinds = collect($res->json('attention'))->pluck('kind');
        $this->assertContains('billing', $kinds);
        $this->assertContains('task', $kinds);
    }

    public function test_sections_follow_permissions(): void
    {
        $this->seedMoney();
        $dev = User::factory()->create(['role' => Role::Developer, 'approval_status' => 'approved']);
        Sanctum::actingAs($dev);

        $res = $this->getJson('/api/v1/dashboard')->assertOk();
        $this->assertNotContains('finance', $res->json('sections'));
        $res->assertJsonMissingPath('finance');
        $this->assertNotContains('billing', collect($res->json('attention'))->pluck('kind'));

        $this->getJson('/api/v1/admin/expenses')->assertForbidden();
    }

    public function test_customers_cannot_open_the_team_dashboard(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => Role::Customer, 'approval_status' => 'approved']));
        $this->getJson('/api/v1/dashboard')->assertForbidden();
    }

    public function test_expense_crud_and_monthly_summary(): void
    {
        Sanctum::actingAs($this->admin);

        $id = $this->postJson('/api/v1/admin/expenses', [
            'spent_on' => '2026-03-03', 'category' => ' Internet & Phone ', 'description' => 'PLDT fiber', 'amount' => 1699, 'method' => 'gcash',
        ])->assertCreated()->assertJsonPath('data.category', 'Internet & Phone')->json('data.id');

        $this->postJson('/api/v1/admin/expenses', ['spent_on' => '2026-03-04', 'category' => 'Other', 'description' => 'x', 'amount' => 0])
            ->assertJsonValidationErrors('amount');

        $this->patchJson("/api/v1/admin/expenses/{$id}", [
            'spent_on' => '2026-03-03', 'category' => 'Internet & Phone', 'description' => 'PLDT fiber', 'amount' => 1799,
        ])->assertOk()->assertJsonPath('data.amount', 1799);

        $this->getJson('/api/v1/admin/expenses?month=2026-03')->assertOk()
            ->assertJsonPath('summary.total', 1799)
            ->assertJsonPath('summary.by_category.0.category', 'Internet & Phone')
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/v1/admin/expenses?month=2026-02')->assertOk()->assertJsonCount(0, 'data');

        $this->deleteJson("/api/v1/admin/expenses/{$id}")->assertNoContent();
        $this->assertDatabaseCount('expenses', 0);
    }
}
