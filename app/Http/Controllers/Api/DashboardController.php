<?php

namespace App\Http\Controllers\Api;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ClientSystemResource;
use App\Models\ClientSystem;
use App\Models\Expense;
use App\Models\Lead;
use App\Models\Payout;
use App\Models\SystemPayment;
use App\Models\Task;
use App\Models\Ticket;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * One live snapshot for the team dashboard. The page polls this (every ~30s),
 * so it returns only the sections the user may see, as plain aggregates.
 */
class DashboardController extends Controller
{
    private const OPEN_TICKET = [TicketStatus::Open, TicketStatus::Reopened];

    private const ACTIVE_TICKET = [TicketStatus::Open, TicketStatus::Accepted, TicketStatus::Reopened];

    /** The period being looked at: ['from', 'to', 'prev_from', 'prev_to', 'label', 'bucket']. */
    private array $range;

    public function index(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isTeam(), 403);

        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d', 'required_with:to'],
            'to' => ['nullable', 'date_format:Y-m-d', 'required_with:from', 'after_or_equal:from'],
        ]);
        $this->range = self::resolveRange($request->input('from'), $request->input('to'));

        $canFinance = $user->hasPermission(Permissions::BILLING);
        $canSupport = $user->hasPermission(Permissions::TICKETS) || $user->hasPermission(Permissions::ANALYTICS);
        $canLeads = $user->hasPermission(Permissions::LEADS);

        $out = [
            'generated_at' => now()->toIso8601String(),
            'range' => [
                'from' => $this->range['from']->toDateString(),
                'to' => $this->range['to']->toDateString(),
                'prev_from' => $this->range['prev_from']->toDateString(),
                'prev_to' => $this->range['prev_to']->toDateString(),
                'label' => $this->range['label'],
                'bucket' => $this->range['bucket'],
                'includes_today' => $this->range['from']->lte(today()) && $this->range['to']->gte(today()),
            ],
            'sections' => array_values(array_filter([
                'overview',
                $canFinance ? 'finance' : null,
                $canFinance ? 'payouts' : null,
                $canFinance ? 'expenses' : null,
                $canSupport ? 'support' : null,
                'work',
            ])),
            'work' => $this->work($user, $canLeads),
        ];

        if ($canFinance) {
            $out['finance'] = $this->finance();
        }
        if ($canSupport) {
            $out['support'] = $this->support();
        }
        $out['attention'] = $this->attention($user, $canFinance, $canSupport, $canLeads);

        return response()->json($out);
    }

    // ---------------------------------------------------------------- finance

    private function finance(): array
    {
        ['from' => $from, 'to' => $to, 'prev_from' => $prevFrom, 'prev_to' => $prevTo] = $this->range;
        $period = [$from->toDateString(), $to->toDateString()];
        $sum = fn ($model, $col, Carbon $a, Carbon $b) => round((float) $model::whereBetween($col, [$a->toDateString(), $b->toDateString()])->sum('amount'), 2);

        $revenue = $sum(SystemPayment::class, 'paid_at', $from, $to);
        $expenses = $sum(Expense::class, 'spent_on', $from, $to);
        // The previous period of the same length (same days of last month for "this month").
        $revenuePrev = $sum(SystemPayment::class, 'paid_at', $prevFrom, $prevTo);
        $expensesPrev = $sum(Expense::class, 'spent_on', $prevFrom, $prevTo);

        $active = ClientSystem::active()->get(['amount', 'billing_cycle']);

        return [
            'month' => [
                'label' => $this->range['label'],
                'revenue' => $revenue,
                'expenses' => $expenses,
                'net' => round($revenue - $expenses, 2),
                'revenue_prev' => $revenuePrev,
                'expenses_prev' => $expensesPrev,
                'net_prev' => round($revenuePrev - $expensesPrev, 2),
                // Expenses split: fixed monthly costs paid via Payouts (salaries, maintenance,
                // commissions, bills) vs everything else recorded by hand.
                'fixed_paid' => $fixedPaid = round((float) Expense::whereNotNull('payout_id')->whereBetween('spent_on', $period)->sum('amount'), 2),
                'other_expenses' => round($expenses - $fixedPaid, 2),
                'payments_count' => SystemPayment::whereBetween('paid_at', $period)->count(),
            ],
            'receivables' => [
                'overdue_count' => ClientSystem::overdue()->count(),
                'overdue_amount' => round((float) ClientSystem::overdue()->sum('amount'), 2),
                'due_soon_count' => ClientSystem::dueSoon()->count(),
                'due_soon_amount' => round((float) ClientSystem::dueSoon()->sum('amount'), 2),
                'setup_unpaid_count' => ClientSystem::setupUnpaid()->count(),
                'setup_unpaid_amount' => round((float) ClientSystem::setupUnpaid()->sum('setup_fee'), 2),
            ],
            'setup_revenue' => round((float) SystemPayment::where('kind', 'setup')->whereBetween('paid_at', $period)->sum('amount'), 2),
            'mrr' => round($active->sum(fn ($s) => $s->monthlyValue()), 2),
            'active_systems' => $active->count(),
            'trend' => $this->moneyTrend(),
            'expenses_by_category' => Expense::whereBetween('spent_on', $period)
                ->selectRaw('category, SUM(amount) as total')->groupBy('category')->orderByDesc('total')->get()
                ->map(fn ($r) => ['category' => $r->category, 'total' => round((float) $r->total, 2)])->values(),
            'due' => ClientSystemResource::collection(
                ClientSystem::with(['client', 'systemType'])->active()
                    ->whereDate('next_due_date', '<=', today()->addDays(ClientSystem::DUE_SOON_DAYS))
                    ->orderBy('next_due_date')->limit(8)->get()
            ),
            'recent_payments' => SystemPayment::with(['client:id,name,store_name', 'clientSystem.systemType'])
                ->orderByDesc('paid_at')->orderByDesc('id')->limit(6)->get()
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'client' => $p->client?->store_name ?: $p->client?->name,
                    'system' => $p->clientSystem?->displayName(),
                    'amount' => (float) $p->amount,
                    'kind' => $p->kind ?? 'subscription',
                    'paid_at' => Carbon::parse($p->paid_at)->toDateString(),
                    'method' => $p->method,
                ]),
            // One-time setup fees still to collect — paid straight from the dashboard.
            'setup_unpaid' => ClientSystemResource::collection(
                ClientSystem::with(['client', 'systemType'])->setupUnpaid()->orderBy('started_on')->limit(8)->get()
            ),
            // What we owe people (developer, marketing, agents' commissions).
            'payouts' => [
                ...\App\Http\Controllers\Api\Admin\PayoutController::summary(),
                'due' => Payout::with(\App\Http\Controllers\Api\Admin\PayoutController::RELATIONS)->dueSoon()
                    ->orderBy('next_due_date')->limit(10)->get()->map->present()->values(),
            ],
            'recent_expenses' => Expense::orderByDesc('spent_on')->orderByDesc('id')->limit(6)->get()
                ->map(fn ($e) => [
                    'id' => $e->id, 'description' => $e->description, 'category' => $e->category,
                    'amount' => (float) $e->amount, 'spent_on' => $e->spent_on->toDateString(),
                ]),
        ];
    }

    /**
     * Revenue vs expenses over the selected range, by day (short ranges) or month.
     * A single month gets the 6 months up to it, so there's something to compare against.
     */
    private function moneyTrend(): array
    {
        ['from' => $from, 'to' => $to, 'bucket' => $bucket] = $this->range;
        if ($this->range['single_month']) {
            $from = $from->copy()->subMonthsNoOverflow(5);
            $bucket = 'month';
        }
        $range = [$from->toDateString(), $to->toDateString()];
        $fmt = $bucket === 'day' ? 'Y-m-d' : 'Y-m';

        $revenue = SystemPayment::whereBetween('paid_at', $range)->get(['paid_at', 'amount'])
            ->groupBy(fn ($p) => Carbon::parse($p->paid_at)->format($fmt))->map->sum('amount');
        $expenses = Expense::whereBetween('spent_on', $range)->get(['spent_on', 'amount'])
            ->groupBy(fn ($e) => $e->spent_on->format($fmt))->map->sum('amount');

        $out = [];
        foreach (self::buckets($from, $to, $bucket) as [$key, $label]) {
            $r = round((float) ($revenue[$key] ?? 0), 2);
            $e = round((float) ($expenses[$key] ?? 0), 2);
            $out[] = ['month' => $key, 'label' => $label, 'revenue' => $r, 'expenses' => $e, 'net' => round($r - $e, 2)];
        }

        return $out;
    }

    /** [[key, label], …] for each day or month between $from and $to. */
    private static function buckets(Carbon $from, Carbon $to, string $bucket): array
    {
        $out = [];
        $multiYear = $from->year !== $to->year;
        if ($bucket === 'day') {
            for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
                $out[] = [$d->format('Y-m-d'), $d->format('M j')];
            }
        } else {
            for ($m = $from->copy()->startOfMonth(); $m->lte($to); $m->addMonthNoOverflow()) {
                $out[] = [$m->format('Y-m'), $m->format($multiYear ? "M 'y" : 'M')];
            }
        }

        return $out;
    }

    /**
     * Turn ?from=&to= into the period plus the one to compare with. Default: this month.
     * Whole months compare with the same days of the months before (Nov 1–19 vs Oct 1–19);
     * any other range with the same number of days right before it.
     */
    public static function resolveRange(?string $from, ?string $to): array
    {
        $from = $from ? Carbon::parse($from)->startOfDay() : today()->startOfMonth();
        $to = $to ? Carbon::parse($to)->startOfDay() : today()->endOfMonth()->startOfDay();
        if ($from->diffInDays($to) > 366 * 5) {
            $from = $to->copy()->subYears(5)->addDay(); // keep queries bounded
        }

        $wholeMonths = $from->day === 1 && $to->isSameDay($to->copy()->endOfMonth());
        // Compare only the part that has happened so far.
        $elapsedTo = $to->gt(today()) ? today()->max($from) : $to;
        $days = (int) $from->diffInDays($elapsedTo) + 1;

        if ($wholeMonths) {
            $months = ($to->year - $from->year) * 12 + $to->month - $from->month + 1;
            $prevFrom = $from->copy()->subMonthsNoOverflow($months);
            $prevTo = $prevFrom->copy()->addDays($days - 1)->min($from->copy()->subDay());
        } else {
            $prevTo = $from->copy()->subDay();
            $prevFrom = $prevTo->copy()->subDays($days - 1);
        }

        $singleMonth = $wholeMonths && $from->isSameMonth($to);
        $label = match (true) {
            $singleMonth => $from->format('F Y'),
            $wholeMonths && $from->month === 1 && $to->month === 12 && $from->year === $to->year => (string) $from->year,
            $wholeMonths && $from->month % 3 === 1 && $from->isSameYear($to) && $to->month === $from->month + 2 => 'Q'.intdiv($from->month + 2, 3).' '.$from->year,
            $from->isSameDay($to) => $from->format('M j, Y'),
            $from->isSameYear($to) => $from->format('M j').' – '.$to->format('M j, Y'),
            default => $from->format('M j, Y').' – '.$to->format('M j, Y'),
        };

        return [
            'from' => $from, 'to' => $to, 'prev_from' => $prevFrom, 'prev_to' => $prevTo,
            'label' => $label, 'single_month' => $singleMonth,
            'bucket' => $from->diffInDays($to) <= 62 ? 'day' : 'month',
        ];
    }

    // ---------------------------------------------------------------- support

    private function support(): array
    {
        // Ticket flow across the selected range (but never into the future).
        ['from' => $from, 'bucket' => $bucket] = $this->range;
        $to = $this->range['to']->copy()->min(today())->max($from);
        $window = [$from->copy()->startOfDay(), $to->copy()->endOfDay()];
        $fmt = $bucket === 'day' ? 'Y-m-d' : 'Y-m';
        $created = Ticket::whereBetween('created_at', $window)->get(['created_at'])
            ->groupBy(fn ($t) => $t->created_at->format($fmt))->map->count();
        $resolved = Ticket::whereBetween('resolved_at', $window)->get(['resolved_at'])
            ->groupBy(fn ($t) => $t->resolved_at->format($fmt))->map->count();
        $daily = [];
        foreach (self::buckets($from, $to, $bucket) as [$k, $label]) {
            $daily[] = ['date' => $k, 'label' => $label, 'created' => (int) ($created[$k] ?? 0), 'resolved' => (int) ($resolved[$k] ?? 0)];
        }

        $byUrgency = Ticket::with('urgency:id,name,color,sort_order')->whereIn('status', self::ACTIVE_TICKET)->get(['id', 'urgency_id'])
            ->groupBy('urgency_id')->map(fn ($g) => [
                'name' => $g->first()->urgency?->name ?? 'No urgency',
                'color' => $g->first()->urgency?->color ?? '#8A96B8',
                'sort' => $g->first()->urgency?->sort_order ?? 99,
                'value' => $g->count(),
            ])->sortByDesc('sort')->values();

        return [
            'waiting' => Ticket::whereIn('status', self::OPEN_TICKET)->count(),
            'in_progress' => Ticket::where('status', TicketStatus::Accepted)->count(),
            'sla_breached' => $this->slaBreachedQuery()->count(),
            'created_today' => Ticket::whereDate('created_at', today())->count(),
            'resolved_today' => Ticket::whereDate('resolved_at', today())->count(),
            'daily' => $daily,
            'created_in_range' => (int) $created->sum(),
            'resolved_in_range' => (int) $resolved->sum(),
            'by_urgency' => $byUrgency,
            'oldest_waiting' => Ticket::with(['customer:id,name,store_name', 'urgency:id,name,color'])
                ->whereIn('status', self::OPEN_TICKET)->oldest()->limit(6)->get()
                ->map(fn ($t) => $this->ticketRow($t)),
        ];
    }

    private function slaBreachedQuery()
    {
        return Ticket::whereIn('status', self::ACTIVE_TICKET)
            ->whereNotNull('expected_resolution_at')->where('expected_resolution_at', '<', now());
    }

    private function ticketRow(Ticket $t): array
    {
        return [
            'id' => $t->id,
            'number' => $t->ticket_number,
            'subject' => $t->subject,
            'client' => $t->customer?->store_name ?: $t->customer?->name,
            'urgency' => $t->urgency ? ['name' => $t->urgency->name, 'color' => $t->urgency->color] : null,
            'status' => $t->status instanceof TicketStatus ? $t->status->value : $t->status,
            'created_at' => $t->created_at,
        ];
    }

    // ---------------------------------------------------------------- work

    private function work(User $user, bool $canLeads): array
    {
        $teamWide = $user->hasPermission(Permissions::TASKS_MANAGE);
        $scope = fn () => Task::query()->when(! $teamWide, fn ($q) => $q->where('assignee_id', $user->id));

        $byStatus = $scope()->selectRaw('status, COUNT(*) as c')->groupBy('status')->pluck('c', 'status');

        $work = [
            'scope' => $teamWide ? 'team' : 'mine',
            'tasks' => [
                'by_status' => collect(Task::STATUSES)->map(fn ($s) => ['status' => $s, 'value' => (int) ($byStatus[$s] ?? 0)])->values(),
                'open' => $scope()->where('status', '!=', 'done')->count(),
                'overdue' => $scope()->where('status', '!=', 'done')->whereNotNull('due_date')->whereDate('due_date', '<', today())->count(),
                'due_today' => $scope()->where('status', '!=', 'done')->whereDate('due_date', today())->count(),
                'done_this_week' => $scope()->where('status', 'done')->where('completed_at', '>=', today()->startOfWeek())->count(),
                'mine_open' => Task::where('assignee_id', $user->id)->where('status', '!=', 'done')->count(),
                'upcoming' => $scope()->with(['assignee:id,name', 'client:id,name,store_name'])
                    ->where('status', '!=', 'done')
                    ->orderByRaw('due_date IS NULL')->orderBy('due_date')
                    ->orderByRaw("FIELD(priority, 'urgent', 'high', 'medium', 'low')")
                    ->limit(8)->get()
                    ->map(fn (Task $t) => [
                        'id' => $t->id, 'title' => $t->title, 'status' => $t->status, 'priority' => $t->priority,
                        'due_date' => $t->due_date?->toDateString(), 'is_overdue' => $t->isOverdue(),
                        'assignee' => $t->assignee?->name,
                        'client' => $t->client?->store_name ?: $t->client?->name,
                    ]),
            ],
        ];

        if ($canLeads) {
            $open = ['new', 'contacted', 'demo', 'proposal'];
            $stages = Lead::selectRaw('stage, COUNT(*) as c, COALESCE(SUM(estimated_value), 0) as v')->groupBy('stage')->get()->keyBy('stage');
            $work['leads'] = [
                'stages' => collect(Lead::STAGES)->map(fn ($s) => [
                    'stage' => $s, 'count' => (int) ($stages[$s]->c ?? 0), 'value' => round((float) ($stages[$s]->v ?? 0), 2),
                ])->values(),
                'pipeline_value' => round((float) Lead::whereIn('stage', $open)->sum('estimated_value'), 2),
                'pipeline_monthly' => round((float) Lead::whereIn('stage', $open)->sum('monthly_fee'), 2),
                'open' => Lead::whereIn('stage', $open)->count(),
                'won_this_month' => Lead::where('stage', 'won')->where('converted_at', '>=', today()->startOfMonth())->count(),
                'won_in_range' => Lead::where('stage', 'won')
                    ->whereBetween('converted_at', [$this->range['from']->copy()->startOfDay(), $this->range['to']->copy()->endOfDay()])->count(),
                'follow_ups' => Lead::with('owner:id,name')->whereIn('stage', $open)
                    ->whereNotNull('next_follow_up')->whereDate('next_follow_up', '<=', today()->addDays(2))
                    ->orderBy('next_follow_up')->limit(6)->get()
                    ->map(fn (Lead $l) => [
                        'id' => $l->id, 'business_name' => $l->business_name, 'stage' => $l->stage,
                        'next_follow_up' => $l->next_follow_up->toDateString(),
                        'is_overdue' => $l->next_follow_up->lt(today()),
                        'owner' => $l->owner?->name, 'value' => (float) $l->estimated_value,
                        'monthly_fee' => (float) $l->monthly_fee,
                    ]),
            ];
        }

        return $work;
    }

    // ---------------------------------------------------------------- attention

    /** The few things that need someone today, most urgent first. */
    private function attention(User $user, bool $canFinance, bool $canSupport, bool $canLeads): array
    {
        $items = collect();

        if ($canSupport) {
            $this->slaBreachedQuery()->with('customer:id,name,store_name')->orderBy('expected_resolution_at')->limit(5)->get()
                ->each(fn ($t) => $items->push([
                    'kind' => 'sla', 'severity' => 3, 'title' => "{$t->ticket_number} is past its SLA",
                    'subtitle' => ($t->customer?->store_name ?: $t->customer?->name).' · '.$t->subject,
                    'link' => "/app/tickets/{$t->id}", 'at' => $t->expected_resolution_at,
                ]));
            Ticket::with('customer:id,name,store_name')->whereIn('status', self::OPEN_TICKET)
                ->where('created_at', '<', now()->subHour())->oldest()->limit(5)->get()
                ->each(fn ($t) => $items->push([
                    'kind' => 'waiting', 'severity' => 2, 'title' => "{$t->ticket_number} waiting for pickup",
                    'subtitle' => ($t->customer?->store_name ?: $t->customer?->name).' · '.$t->subject,
                    'link' => "/app/tickets/{$t->id}", 'at' => $t->created_at,
                ]));
        }

        if ($canFinance) {
            ClientSystem::with(['client', 'systemType'])->overdue()->orderBy('next_due_date')->limit(5)->get()
                ->each(fn ($s) => $items->push([
                    'kind' => 'billing', 'severity' => 3, 'title' => ($s->client?->store_name ?: $s->client?->name).' is overdue',
                    'subtitle' => $s->displayName().' · ₱'.number_format((float) $s->amount, 2).' since '.$s->next_due_date->format('M j'),
                    'link' => "/app/admin/client-systems?focus={$s->id}", 'at' => $s->next_due_date,
                ]));
            Payout::overdue()->orderBy('next_due_date')->limit(5)->get()
                ->each(fn ($p) => $items->push([
                    'kind' => 'payout', 'severity' => 2, 'title' => "Pay {$p->payee_name}: {$p->category}",
                    'subtitle' => '₱'.number_format((float) $p->amount, 2).' · was due '.$p->next_due_date->format('M j'),
                    'link' => '/app?tab=payouts', 'at' => $p->next_due_date,
                ]));
            ClientSystem::with(['client', 'systemType'])->setupUnpaid()->orderBy('started_on')->limit(5)->get()
                ->each(fn ($s) => $items->push([
                    'kind' => 'setup', 'severity' => 1, 'title' => 'Setup fee unpaid: '.($s->client?->store_name ?: $s->client?->name),
                    'subtitle' => $s->displayName().' · ₱'.number_format((float) $s->setup_fee, 2).' one-time',
                    'link' => "/app/admin/client-systems?focus={$s->id}", 'at' => $s->started_on ?? $s->created_at,
                ]));
        }

        $teamWide = $user->hasPermission(Permissions::TASKS_MANAGE);
        Task::with('assignee:id,name')->where('status', '!=', 'done')->whereNotNull('due_date')->whereDate('due_date', '<', today())
            ->when(! $teamWide, fn ($q) => $q->where('assignee_id', $user->id))
            ->orderBy('due_date')->limit(5)->get()
            ->each(fn ($t) => $items->push([
                'kind' => 'task', 'severity' => 2, 'title' => "Overdue task: {$t->title}",
                'subtitle' => ($t->assignee?->name ?? 'Unassigned').' · due '.$t->due_date->format('M j'),
                'link' => "/app/tasks?task={$t->id}", 'at' => $t->due_date,
            ]));

        if ($canLeads) {
            Lead::whereIn('stage', ['new', 'contacted', 'demo', 'proposal'])->whereNotNull('next_follow_up')
                ->whereDate('next_follow_up', '<', today())->orderBy('next_follow_up')->limit(5)->get()
                ->each(fn ($l) => $items->push([
                    'kind' => 'lead', 'severity' => 1, 'title' => "Follow up {$l->business_name}",
                    'subtitle' => 'Was due '.$l->next_follow_up->format('M j').' · '.ucfirst($l->stage),
                    'link' => '/app/leads', 'at' => $l->next_follow_up,
                ]));
        }

        return $items->sortBy([['severity', 'desc'], fn ($a, $b) => Carbon::parse($a['at'])->timestamp <=> Carbon::parse($b['at'])->timestamp])
            ->take(12)->values()->all();
    }
}
