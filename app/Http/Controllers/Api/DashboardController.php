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

    public function index(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isTeam(), 403);

        $canFinance = $user->hasPermission(Permissions::BILLING);
        $canSupport = $user->hasPermission(Permissions::TICKETS) || $user->hasPermission(Permissions::ANALYTICS);
        $canLeads = $user->hasPermission(Permissions::LEADS);

        $out = [
            'generated_at' => now()->toIso8601String(),
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
        $monthStart = today()->startOfMonth();
        $prevStart = $monthStart->copy()->subMonthNoOverflow();
        $sum = fn ($model, $col, Carbon $from, Carbon $to) => round((float) $model::whereBetween($col, [$from->toDateString(), $to->toDateString()])->sum('amount'), 2);

        $revenue = $sum(SystemPayment::class, 'paid_at', $monthStart, today()->endOfMonth());
        $expenses = $sum(Expense::class, 'spent_on', $monthStart, today()->endOfMonth());
        // Same days of last month, so mid-month comparisons are fair.
        $prevSameDay = $prevStart->copy()->addDays(min(today()->day, $prevStart->daysInMonth) - 1);
        $revenuePrev = $sum(SystemPayment::class, 'paid_at', $prevStart, $prevSameDay);
        $expensesPrev = $sum(Expense::class, 'spent_on', $prevStart, $prevSameDay);

        $active = ClientSystem::active()->get(['amount', 'billing_cycle']);

        return [
            'month' => [
                'label' => $monthStart->format('F Y'),
                'revenue' => $revenue,
                'expenses' => $expenses,
                'net' => round($revenue - $expenses, 2),
                'revenue_prev' => $revenuePrev,
                'expenses_prev' => $expensesPrev,
                'net_prev' => round($revenuePrev - $expensesPrev, 2),
                'payments_count' => SystemPayment::whereBetween('paid_at', [$monthStart->toDateString(), today()->endOfMonth()->toDateString()])->count(),
            ],
            'receivables' => [
                'overdue_count' => ClientSystem::overdue()->count(),
                'overdue_amount' => round((float) ClientSystem::overdue()->sum('amount'), 2),
                'due_soon_count' => ClientSystem::dueSoon()->count(),
                'due_soon_amount' => round((float) ClientSystem::dueSoon()->sum('amount'), 2),
                'setup_unpaid_count' => ClientSystem::setupUnpaid()->count(),
                'setup_unpaid_amount' => round((float) ClientSystem::setupUnpaid()->sum('setup_fee'), 2),
            ],
            'setup_revenue' => round((float) SystemPayment::where('kind', 'setup')
                ->whereBetween('paid_at', [$monthStart->toDateString(), today()->endOfMonth()->toDateString()])->sum('amount'), 2),
            'mrr' => round($active->sum(fn ($s) => $s->monthlyValue()), 2),
            'active_systems' => $active->count(),
            'trend' => $this->monthlyTrend(6),
            'expenses_by_category' => Expense::whereBetween('spent_on', [$monthStart->toDateString(), today()->endOfMonth()->toDateString()])
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

    /** Revenue vs expenses for the last N months (including this one). */
    private function monthlyTrend(int $months): array
    {
        $start = today()->startOfMonth()->subMonthsNoOverflow($months - 1);
        $range = [$start->toDateString(), today()->endOfMonth()->toDateString()];

        $revenue = SystemPayment::whereBetween('paid_at', $range)->get(['paid_at', 'amount'])
            ->groupBy(fn ($p) => Carbon::parse($p->paid_at)->format('Y-m'))->map->sum('amount');
        $expenses = Expense::whereBetween('spent_on', $range)->get(['spent_on', 'amount'])
            ->groupBy(fn ($e) => $e->spent_on->format('Y-m'))->map->sum('amount');

        $out = [];
        for ($m = $start->copy(); $m->lte(today()); $m->addMonthNoOverflow()) {
            $key = $m->format('Y-m');
            $r = round((float) ($revenue[$key] ?? 0), 2);
            $e = round((float) ($expenses[$key] ?? 0), 2);
            $out[] = ['month' => $key, 'label' => $m->format('M'), 'revenue' => $r, 'expenses' => $e, 'net' => round($r - $e, 2)];
        }

        return $out;
    }

    // ---------------------------------------------------------------- support

    private function support(): array
    {
        $since = today()->subDays(13);
        $created = Ticket::where('created_at', '>=', $since)->get(['created_at'])
            ->groupBy(fn ($t) => $t->created_at->toDateString())->map->count();
        $resolved = Ticket::where('resolved_at', '>=', $since)->get(['resolved_at'])
            ->groupBy(fn ($t) => $t->resolved_at->toDateString())->map->count();
        $daily = [];
        for ($d = $since->copy(); $d->lte(today()); $d->addDay()) {
            $k = $d->toDateString();
            $daily[] = ['date' => $k, 'label' => $d->format('M j'), 'created' => (int) ($created[$k] ?? 0), 'resolved' => (int) ($resolved[$k] ?? 0)];
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
