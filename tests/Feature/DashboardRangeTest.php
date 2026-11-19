<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Http\Controllers\Api\DashboardController;
use App\Models\Expense;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Dashboard ?from=&to= filter: totals, comparison period, chart buckets and labels. */
class DashboardRangeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['broadcasting.default' => 'null']);
        Carbon::setTestNow('2026-11-19 10:00:00');
        Sanctum::actingAs(User::factory()->create(['role' => Role::Admin, 'approval_status' => 'approved']));

        foreach (['2026-09-10' => 100, '2026-10-05' => 200, '2026-10-25' => 400, '2026-11-03' => 800] as $day => $amount) {
            Expense::create(['spent_on' => $day, 'category' => 'Other', 'description' => 'x', 'amount' => $amount]);
        }
    }

    public function test_defaults_to_this_month_compared_with_same_days_last_month(): void
    {
        $this->getJson('/api/v1/dashboard')->assertOk()
            ->assertJsonPath('range.from', '2026-11-01')
            ->assertJsonPath('range.to', '2026-11-30')
            ->assertJsonPath('range.prev_from', '2026-10-01')
            ->assertJsonPath('range.prev_to', '2026-10-19')     // Oct 1–19, not all of October
            ->assertJsonPath('range.label', 'November 2026')
            ->assertJsonPath('finance.month.expenses', 800)
            ->assertJsonPath('finance.month.expenses_prev', 200)
            ->assertJsonCount(6, 'finance.trend');              // a single month shows 6 months of context
    }

    public function test_custom_range_totals_and_daily_chart(): void
    {
        $res = $this->getJson('/api/v1/dashboard?from=2026-10-01&to=2026-11-10')->assertOk()
            ->assertJsonPath('range.label', 'Oct 1 – Nov 10, 2026')
            ->assertJsonPath('range.bucket', 'day')
            ->assertJsonPath('range.prev_from', '2026-08-21')  // 41 days right before
            ->assertJsonPath('range.prev_to', '2026-09-30')
            ->assertJsonPath('finance.month.expenses', 1400)
            ->assertJsonPath('finance.month.expenses_prev', 100);

        $this->assertCount(41, $res->json('finance.trend'));
        $this->assertSame('Oct 25', collect($res->json('finance.trend'))->firstWhere('expenses', 400)['label']);
    }

    public function test_long_range_uses_months_and_validates_order(): void
    {
        $this->getJson('/api/v1/dashboard?from=2026-01-01&to=2026-12-31')->assertOk()
            ->assertJsonPath('range.label', '2026')
            ->assertJsonPath('range.bucket', 'month')
            ->assertJsonCount(12, 'finance.trend')
            ->assertJsonPath('finance.month.expenses', 1500);

        $this->getJson('/api/v1/dashboard?from=2026-11-10&to=2026-11-01')->assertUnprocessable();
    }

    public function test_range_labels(): void
    {
        $label = fn ($a, $b) => DashboardController::resolveRange($a, $b)['label'];

        $this->assertSame('Q4 2026', $label('2026-10-01', '2026-12-31'));
        $this->assertSame('Nov 19, 2026', $label('2026-11-19', '2026-11-19'));
        $this->assertSame('Dec 15, 2025 – Jan 10, 2026', $label('2025-12-15', '2026-01-10'));
    }
}
