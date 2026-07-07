<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemType;
use App\Models\Ticket;
use App\Models\TicketActivity;
use Illuminate\Support\Facades\Cache;

class StatsController extends Controller
{
    /**
     * Public landing-page stats — real numbers, cached for 5 minutes.
     */
    public function index()
    {
        $stats = Cache::remember('public-stats', 300, function () {
            $resolvedCount = Ticket::whereNotNull('resolved_at')
                ->orWhereIn('status', ['resolved', 'closed'])
                ->count();

            $avgResponse = Ticket::whereNotNull('accepted_at')
                ->get()
                ->avg(fn ($t) => $t->response_time_minutes);

            $systems = SystemType::where('is_active', true)->count();

            // Satisfaction proxy: % of finished tickets that were never reopened.
            $finished = Ticket::whereIn('status', ['resolved', 'closed'])->count()
                + TicketActivity::where('action', 'reopened')->distinct('ticket_id')->count('ticket_id');
            $reopened = TicketActivity::where('action', 'reopened')->distinct('ticket_id')->count('ticket_id');
            $satisfaction = $finished > 0 ? round((1 - $reopened / $finished) * 100) : null;

            return [
                'tickets_resolved' => $resolvedCount,
                'avg_response_minutes' => $avgResponse ? round($avgResponse) : null,
                'systems_supported' => $systems,
                'satisfaction_percent' => $satisfaction,
            ];
        });

        return response()->json($stats);
    }
}
