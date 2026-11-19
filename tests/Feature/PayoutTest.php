<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\ClientSystem;
use App\Models\Expense;
use App\Models\Payout;
use App\Models\SystemType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Developer ₱1,500/mo for maintenance, marketing ₱1,000/mo, and an outside agent
 * getting ₱3,000/mo commission on a ₱15,000/mo system (+ a one-time setup commission).
 */
class PayoutTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $dev;

    private User $marketer;

    private ClientSystem $system;

    protected function setUp(): void
    {
        parent::setUp();
        config(['broadcasting.default' => 'null']);
        Carbon::setTestNow('2026-03-10 09:00:00');

        $this->owner = User::factory()->create(['role' => Role::Admin, 'approval_status' => 'approved']);
        $this->dev = User::factory()->create(['role' => Role::Developer, 'name' => 'Dev Dan', 'approval_status' => 'approved']);
        $this->marketer = User::factory()->create(['role' => Role::Marketing, 'name' => 'Mia Marketing', 'approval_status' => 'approved']);
        $client = User::factory()->create(['role' => Role::Customer, 'store_name' => 'Big Client Inc', 'approval_status' => 'approved']);
        $type = SystemType::create(['name' => 'POS System', 'is_active' => true]);
        $this->system = ClientSystem::create([
            'client_id' => $client->id, 'system_type_id' => $type->id, 'amount' => 15000, 'setup_fee' => 50000,
            'billing_cycle' => 'monthly', 'next_due_date' => '2026-03-15',
        ]);
        Sanctum::actingAs($this->owner);
    }

    private function addPayout(array $attrs): int
    {
        return $this->postJson('/api/v1/admin/payouts', [
            'payee_kind' => 'team', 'cycle' => 'monthly', 'next_due_date' => '2026-03-31', ...$attrs,
        ])->assertCreated()->json('data.id');
    }

    private function scenario(): array
    {
        return [
            'dev' => $this->addPayout(['payee_user_id' => $this->dev->id, 'category' => 'Maintenance', 'amount' => 1500, 'description' => 'Maintains all systems']),
            'mkt' => $this->addPayout(['payee_user_id' => $this->marketer->id, 'category' => 'Marketing', 'amount' => 1000]),
            'agent' => $this->addPayout([
                'payee_kind' => 'external', 'payee_name' => 'Agent Ana', 'category' => 'Commission', 'amount' => 3000,
                'client_system_id' => $this->system->id, 'next_due_date' => '2026-03-20', 'payout_method' => 'gcash',
            ]),
        ];
    }

    public function test_monthly_commitments_and_net_after_payouts(): void
    {
        $ids = $this->scenario();

        $res = $this->getJson('/api/v1/admin/payouts')->assertOk()
            ->assertJsonPath('summary.monthly_total', 5500)
            ->assertJsonPath('summary.mrr', 15000)
            ->assertJsonPath('summary.net_mrr', 9500);

        $agent = collect($res->json('data'))->firstWhere('id', $ids['agent']);
        $this->assertSame('Agent Ana', $agent['payee_name']);
        $this->assertEquals(20, $agent['client_system']['share_percent']); // 3K of 15K
        $this->assertSame('Big Client Inc', $agent['client_system']['client_name']);
        $dev = collect($res->json('data'))->firstWhere('id', $ids['dev']);
        $this->assertSame('Dev Dan', $dev['payee_name']); // taken from the team member

        // Client Systems shows what we keep from this system after the commission.
        $this->getJson('/api/v1/admin/client-systems')
            ->assertJsonPath('data.0.net_monthly', 12000)
            ->assertJsonPath('data.0.payouts.0.payee_name', 'Agent Ana');
    }

    public function test_mark_paid_records_expense_and_advances_then_undo_restores(): void
    {
        $ids = $this->scenario();

        $this->postJson("/api/v1/admin/payouts/{$ids['agent']}/pay", ['amount' => 3000, 'paid_on' => '2026-03-10'])
            ->assertCreated()->assertJsonPath('data.next_due_date', '2026-04-20');

        $expense = Expense::sole();
        $this->assertSame('Commission', $expense->category);
        $this->assertSame('Agent Ana', $expense->payee);
        $this->assertSame('gcash', $expense->method);               // their usual payout method
        $this->assertSame($this->system->id, $expense->client_system_id);
        $this->assertStringContainsString('Mar 2026', $expense->description);

        // Shows up in profit numbers.
        $this->getJson('/api/v1/dashboard')
            ->assertJsonPath('finance.month.expenses', 3000)
            ->assertJsonPath('finance.payouts.paid_this_month', 3000);

        // Undo from the payout history → due date goes back.
        $this->deleteJson("/api/v1/admin/payouts/{$ids['agent']}/payments/{$expense->id}")
            ->assertOk()->assertJsonPath('data.next_due_date', '2026-03-20');
        $this->assertSame(0, Expense::count());
    }

    public function test_paying_several_months_ahead_and_anchor_day(): void
    {
        $id = $this->addPayout(['payee_user_id' => $this->dev->id, 'category' => 'Maintenance', 'amount' => 1500, 'next_due_date' => '2026-01-31']);

        $this->postJson("/api/v1/admin/payouts/{$id}/pay", ['amount' => 1500, 'paid_on' => '2026-03-10'])
            ->assertJsonPath('data.next_due_date', '2026-02-28');
        $this->postJson("/api/v1/admin/payouts/{$id}/pay", ['amount' => 3000, 'cycles' => 2, 'paid_on' => '2026-03-10'])
            ->assertJsonPath('data.next_due_date', '2026-04-30');       // back on the 31st-ish anchor, not drifting to the 28th
    }

    public function test_one_time_commission_on_setup_fee_completes_after_paying(): void
    {
        $id = $this->addPayout([
            'payee_kind' => 'external', 'payee_name' => 'Agent Ana', 'category' => 'Commission', 'amount' => 5000,
            'cycle' => 'once', 'client_system_id' => $this->system->id, 'description' => 'Setup commission',
        ]);
        $this->getJson('/api/v1/admin/payouts')->assertJsonPath('summary.monthly_total', 0); // not recurring

        $this->postJson("/api/v1/admin/payouts/{$id}/pay", ['amount' => 5000, 'paid_on' => '2026-03-10'])
            ->assertCreated()->assertJsonPath('data.status', 'completed');
        $this->postJson("/api/v1/admin/payouts/{$id}/pay", ['amount' => 5000, 'paid_on' => '2026-03-10'])->assertStatus(422);

        // Deleting that expense from the Expenses tab re-opens it.
        $this->deleteJson('/api/v1/admin/expenses/'.Expense::sole()->id)->assertNoContent();
        $this->assertSame('active', Payout::find($id)->status);
    }

    public function test_dashboard_shows_due_payouts_setup_fees_and_attention(): void
    {
        $this->scenario();
        Carbon::setTestNow('2026-03-25 09:00:00'); // agent's Mar 20 payout is now overdue

        $res = $this->getJson('/api/v1/dashboard')->assertOk();
        $this->assertContains('payouts', $res->json('sections'));
        $res->assertJsonPath('finance.payouts.overdue_count', 1)
            ->assertJsonPath('finance.payouts.net_mrr', 9500)
            ->assertJsonPath('finance.setup_unpaid.0.setup_fee', 50000);
        $this->assertCount(3, $res->json('finance.payouts.due')); // overdue + 2 due on the 31st
        $this->assertTrue(collect($res->json('attention'))->contains(fn ($a) => $a['kind'] === 'payout' && str_contains($a['title'], 'Agent Ana')));
    }

    public function test_pay_all_due_in_one_click(): void
    {
        $ids = $this->scenario(); // dev + marketing due Mar 31, agent due Mar 20
        $rent = $this->addPayout(['payee_kind' => 'bill', 'payee_name' => 'Office rent', 'category' => 'Rent & Utilities', 'amount' => 8000]);
        $paused = $this->addPayout(['payee_user_id' => $this->dev->id, 'category' => 'Salaries & Payroll', 'amount' => 10000]);
        Payout::find($paused)->update(['status' => 'paused']);

        $this->getJson('/api/v1/admin/payouts')
            ->assertJsonPath('summary.due_this_month_count', 4)
            ->assertJsonPath('summary.due_this_month_amount', 13500);

        $this->postJson('/api/v1/admin/payouts/pay-bulk', [
            'ids' => [...array_values($ids), $rent, $paused], 'paid_on' => '2026-03-10',
        ])->assertCreated()
            ->assertJsonPath('paid_count', 4)
            ->assertJsonPath('paid_total', 13500)
            ->assertJsonPath('skipped', 1);                   // the paused one

        $this->assertSame(4, Expense::count());
        $this->assertSame('Office rent', Expense::where('payout_id', $rent)->value('payee'));
        $this->assertSame('gcash', Expense::where('payout_id', $ids['agent'])->value('method')); // usual method kept
        $this->assertSame('2026-04-30', Payout::find($ids['dev'])->next_due_date->toDateString());
        $this->assertSame('2026-03-31', Payout::find($paused)->next_due_date->toDateString()); // untouched

        Expense::create(['spent_on' => '2026-03-05', 'category' => 'Office Supplies', 'description' => 'Printer ink', 'amount' => 500]);
        \App\Models\SystemPayment::create([
            'client_system_id' => $this->system->id, 'client_id' => $this->system->client_id, 'system_type_id' => $this->system->system_type_id,
            'amount' => 15000, 'paid_at' => '2026-03-08', 'method' => 'cash',
            'covered_due_date' => '2026-03-15', 'next_due_date' => '2026-04-15',
        ]);

        // Overview earnings: gross 15,000 − fixed 13,500 − other 500 = 1,000.
        $this->getJson('/api/v1/dashboard')
            ->assertJsonPath('finance.month.revenue', 15000)
            ->assertJsonPath('finance.month.fixed_paid', 13500)
            ->assertJsonPath('finance.month.other_expenses', 500)
            ->assertJsonPath('finance.month.net', 1000)
            ->assertJsonPath('finance.payouts.due_this_month_count', 0);
    }

    public function test_only_billing_staff_manage_payouts(): void
    {
        Sanctum::actingAs($this->dev);
        $this->getJson('/api/v1/admin/payouts')->assertForbidden();

        Sanctum::actingAs($this->owner);
        $this->postJson('/api/v1/admin/payouts', ['payee_kind' => 'external', 'category' => 'Commission', 'amount' => 100, 'cycle' => 'monthly', 'next_due_date' => '2026-04-01'])
            ->assertUnprocessable()->assertJsonValidationErrors('payee_name');
    }
}
