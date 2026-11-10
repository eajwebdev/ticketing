<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    private function range(Request $request): array
    {
        $preset = $request->input('range', '30d');

        return match ($preset) {
            'today' => [now()->startOfDay(), now()],
            '7d' => [now()->subDays(7)->startOfDay(), now()],
            '90d' => [now()->subDays(90)->startOfDay(), now()],
            'custom' => [
                $request->filled('from') ? Carbon::parse($request->from)->startOfDay() : now()->subDays(30),
                $request->filled('to') ? Carbon::parse($request->to)->endOfDay() : now(),
            ],
            default => [now()->subDays(30)->startOfDay(), now()],
        };
    }

    private function baseQuery(Request $request)
    {
        [$from, $to] = $this->range($request);

        $q = Ticket::query()->whereBetween('created_at', [$from, $to]);

        if ($request->filled('system_type')) {
            $q->where('system_type_id', $request->system_type);
        }
        if ($request->filled('urgency')) {
            $q->where('urgency_id', $request->urgency);
        }
        if ($request->filled('agent')) {
            $agent = $request->agent;
            $q->where(fn ($sub) => $sub->where('accepted_by', $agent)->orWhere('resolved_by', $agent));
        }

        return $q;
    }

    public function index(Request $request)
    {
        [$from, $to] = $this->range($request);
        $days = max(1, $from->diffInDays($to) ?: 1);
        $prevFrom = (clone $from)->subDays($days);

        $tickets = (clone $this->baseQuery($request))->get();
        $prevTickets = Ticket::whereBetween('created_at', [$prevFrom, $from])->get();

        $resolved = $tickets->whereNotNull('resolved_at');
        $reopened = $tickets->where('status', TicketStatus::Reopened);

        $avgFirstResponse = $tickets->whereNotNull('first_response_at')
            ->avg(fn ($t) => $t->created_at->diffInMinutes($t->first_response_at));
        $avgResolution = $resolved->avg(fn ($t) => $t->resolution_time_minutes);

        // SLA: resolved within urgency sla_hours
        $slaEligible = $resolved->filter(fn ($t) => $t->urgency_id);
        $slaMet = $slaEligible->filter(function ($t) {
            $slaHours = optional($t->urgency)->sla_hours;

            return $slaHours && $t->resolution_time_minutes <= $slaHours * 60;
        });
        $slaPercent = $slaEligible->count() ? round($slaMet->count() / $slaEligible->count() * 100, 1) : null;

        $kpis = [
            'total_tickets' => $tickets->count(),
            'total_tickets_prev' => $prevTickets->count(),
            'open_now' => Ticket::whereIn('status', [TicketStatus::Open, TicketStatus::Reopened])->count(),
            'resolved' => $resolved->count(),
            'avg_first_response_minutes' => $avgFirstResponse ? round($avgFirstResponse) : null,
            'avg_resolution_minutes' => $avgResolution ? round($avgResolution) : null,
            'reopened_rate' => $tickets->count() ? round($reopened->count() / $tickets->count() * 100, 1) : 0,
            'active_clients' => User::where('role', 'customer')->where('is_active', true)->count(),
            'tickets_today' => Ticket::whereDate('created_at', today())->count(),
            'sla_percent' => $slaPercent,
        ];

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'kpis' => $kpis,
            'tickets_over_time' => $this->ticketsOverTime($request, $from, $to),
            'by_system_type' => $this->groupBy($request, 'system_type_id', 'system_types'),
            'by_urgency' => $this->groupBy($request, 'urgency_id', 'urgency_levels'),
            'by_category' => $this->groupBy($request, 'category_id', 'categories'),
            'by_status' => $this->byStatus($request),
            'agent_leaderboard' => $this->agentLeaderboard($from, $to),
            'peak_hours' => $this->peakHours($request),
        ]);
    }

    /**
     * Ticket-creation volume by day-of-week (0=Sun) x hour-of-day (0-23).
     * Returns a flat list of {dow, hour, value} cells.
     */
    private function peakHours(Request $request): array
    {
        $rows = (clone $this->baseQuery($request))
            ->select(
                DB::raw('DAYOFWEEK(created_at) as dow'), // MySQL: 1=Sun..7=Sat
                DB::raw('HOUR(created_at) as h'),
                DB::raw('COUNT(*) as c')
            )
            ->groupBy('dow', 'h')
            ->get();

        $counts = [];
        foreach ($rows as $r) {
            $counts[((int) $r->dow - 1).'-'.(int) $r->h] = (int) $r->c;
        }

        $cells = [];
        for ($dow = 0; $dow < 7; $dow++) {
            for ($h = 0; $h < 24; $h++) {
                $cells[] = ['dow' => $dow, 'hour' => $h, 'value' => $counts["$dow-$h"] ?? 0];
            }
        }

        return $cells;
    }

    private function ticketsOverTime(Request $request, Carbon $from, Carbon $to): array
    {
        $created = (clone $this->baseQuery($request))
            ->select(DB::raw('DATE(created_at) as d'), DB::raw('COUNT(*) as c'))
            ->groupBy('d')->pluck('c', 'd');

        $resolved = Ticket::whereBetween('resolved_at', [$from, $to])
            ->select(DB::raw('DATE(resolved_at) as d'), DB::raw('COUNT(*) as c'))
            ->groupBy('d')->pluck('c', 'd');

        $out = [];
        $cursor = $from->copy()->startOfDay();
        while ($cursor <= $to) {
            $key = $cursor->format('Y-m-d');
            $out[] = [
                'date' => $key,
                'created' => (int) ($created[$key] ?? 0),
                'resolved' => (int) ($resolved[$key] ?? 0),
            ];
            $cursor->addDay();
        }

        return $out;
    }

    private function groupBy(Request $request, string $column, string $table): array
    {
        $rows = (clone $this->baseQuery($request))
            ->select($column, DB::raw('COUNT(*) as c'))
            ->groupBy($column)
            ->get();

        $names = DB::table($table)->pluck('name', 'id');
        $colors = $table === 'urgency_levels' ? DB::table($table)->pluck('color', 'id') : collect();

        return $rows->map(fn ($r) => [
            'id' => $r->$column,
            'name' => $r->$column ? ($names[$r->$column] ?? 'Unknown') : 'Unassigned',
            'value' => (int) $r->c,
            'color' => $colors[$r->$column] ?? null,
        ])->values()->all();
    }

    private function byStatus(Request $request): array
    {
        $rows = (clone $this->baseQuery($request))
            ->select('status', DB::raw('COUNT(*) as c'))
            ->groupBy('status')->get();

        return $rows->map(fn ($r) => [
            'name' => ucfirst($r->status instanceof TicketStatus ? $r->status->value : $r->status),
            'value' => (int) $r->c,
        ])->values()->all();
    }

    private function agentLeaderboard(Carbon $from, Carbon $to): array
    {
        $agents = User::team()->get();

        return $agents->map(function ($agent) use ($from, $to) {
            $resolved = Ticket::where('resolved_by', $agent->id)
                ->whereBetween('resolved_at', [$from, $to])->get();

            $avg = $resolved->avg(fn ($t) => $t->resolution_time_minutes);

            return [
                'id' => $agent->id,
                'name' => $agent->name,
                'avatar_url' => $agent->avatar_url,
                'resolved' => $resolved->count(),
                'avg_resolution_minutes' => $avg ? round($avg) : null,
            ];
        })->sortByDesc('resolved')->values()->all();
    }

    public function export(Request $request)
    {
        $tickets = (clone $this->baseQuery($request))
            ->with(['customer', 'systemType', 'urgency', 'category', 'acceptedBy', 'resolvedBy'])
            ->get();

        $columns = ['Ticket', 'Subject', 'Status', 'Customer', 'System Type', 'Category', 'Urgency',
            'Accepted By', 'Resolved By', 'Response (min)', 'Resolution (min)', 'Created At'];

        $callback = function () use ($tickets, $columns) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $columns);
            foreach ($tickets as $t) {
                fputcsv($out, [
                    $t->ticket_number,
                    $t->subject,
                    $t->status->value,
                    $t->customer?->name,
                    $t->systemType?->name,
                    $t->category?->name,
                    $t->urgency?->name,
                    $t->acceptedBy?->name,
                    $t->resolvedBy?->name,
                    $t->response_time_minutes,
                    $t->resolution_time_minutes,
                    $t->created_at,
                ]);
            }
            fclose($out);
        };

        return response()->streamDownload($callback, 'analytics-'.now()->format('Ymd_His').'.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }
}
