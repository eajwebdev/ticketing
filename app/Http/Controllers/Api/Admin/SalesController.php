<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SystemPaymentResource;
use App\Models\SystemPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SalesController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->from)->startOfDay() : today()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->to)->endOfDay() : today()->endOfDay();

        $filtered = fn () => $this->filter($request, SystemPayment::query())
            ->whereBetween('paid_at', [$from->toDateString(), $to->toDateString()]);

        $sum = fn (string $a, string $b) => (float) SystemPayment::whereBetween('paid_at', [$a, $b])->sum('amount');

        // Monthly totals for the trailing 12 months (grouped in PHP so it works on MySQL and SQLite).
        $start = today()->startOfMonth()->subMonths(11);
        $byMonth = SystemPayment::where('paid_at', '>=', $start->toDateString())
            ->get(['paid_at', 'amount'])
            ->groupBy(fn ($p) => $p->paid_at->format('Y-m'))
            ->map(fn ($g) => (float) $g->sum('amount'));
        $monthly = collect(range(0, 11))->map(function ($i) use ($start, $byMonth) {
            $m = $start->copy()->addMonths($i);

            return ['month' => $m->format('M Y'), 'key' => $m->format('Y-m'), 'total' => $byMonth[$m->format('Y-m')] ?? 0];
        });

        $bySystem = $filtered()
            ->join('system_types', 'system_types.id', '=', 'system_payments.system_type_id')
            ->groupBy('system_types.id', 'system_types.name')
            ->orderByDesc(DB::raw('SUM(system_payments.amount)'))
            ->get(['system_types.name', DB::raw('SUM(system_payments.amount) as total'), DB::raw('COUNT(*) as count')])
            ->map(fn ($r) => ['name' => $r->name, 'total' => (float) $r->total, 'count' => (int) $r->count]);

        $payments = $filtered()
            ->with(['client', 'systemType', 'clientSystem', 'recorder'])
            ->latest('paid_at')->latest('id')
            ->paginate(min($request->integer('per_page', 25), 200))
            ->withQueryString();

        return SystemPaymentResource::collection($payments)->additional([
            'summary' => [
                'range_total' => (float) $filtered()->sum('amount'),
                'range_count' => $filtered()->count(),
                'range_discounts' => (float) $filtered()->sum('discount_amount'),
                'range_setup' => (float) $filtered()->where('system_payments.kind', 'setup')->sum('amount'),
                'range_setup_count' => $filtered()->where('system_payments.kind', 'setup')->count(),
                'this_month' => $sum(today()->startOfMonth()->toDateString(), today()->endOfMonth()->toDateString()),
                'last_month' => $sum(today()->subMonthNoOverflow()->startOfMonth()->toDateString(), today()->subMonthNoOverflow()->endOfMonth()->toDateString()),
                'this_year' => $sum(today()->startOfYear()->toDateString(), today()->endOfYear()->toDateString()),
                'all_time' => (float) SystemPayment::sum('amount'),
            ],
            'monthly' => $monthly,
            'by_system' => $bySystem,
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
        ]);
    }

    /**
     * Void a sale recorded by mistake. If it is the system's latest payment and the
     * due date hasn't moved since, the due date is put back to what it was.
     */
    public function destroy(SystemPayment $payment)
    {
        DB::transaction(function () use ($payment) {
            $system = $payment->clientSystem()->lockForUpdate()->first();

            if ($payment->kind === 'setup') {
                // Voiding the setup payment makes the setup fee unpaid again.
                $system?->update(['setup_paid_at' => null]);
                $payment->delete();

                return;
            }

            $isLatest = ! SystemPayment::where('client_system_id', $payment->client_system_id)
                ->where('kind', 'subscription')
                ->where('id', '>', $payment->id)->exists();

            if ($system && $isLatest && $system->next_due_date->isSameDay($payment->next_due_date)) {
                $system->update(['next_due_date' => $payment->covered_due_date, 'last_reminded_on' => null]);
            }

            $payment->delete();
        });

        return response()->noContent();
    }

    public function export(Request $request)
    {
        $from = $request->filled('from') ? Carbon::parse($request->from)->toDateString() : today()->startOfYear()->toDateString();
        $to = $request->filled('to') ? Carbon::parse($request->to)->toDateString() : today()->toDateString();

        $rows = $this->filter($request, SystemPayment::query())
            ->whereBetween('paid_at', [$from, $to])
            ->with(['client', 'systemType', 'clientSystem', 'recorder'])
            ->orderBy('paid_at')->get();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Paid on', 'Type', 'Client', 'System', 'Label', 'Amount (PHP)', 'Lock-in discount (PHP)', 'Method', 'Reference', 'Covered due date', 'Recorded by']);
            foreach ($rows as $p) {
                fputcsv($out, [
                    $p->paid_at->toDateString(),
                    $p->kind === 'setup' ? 'Setup fee' : 'Subscription',
                    $p->client?->store_name ?: $p->client?->name,
                    $p->systemType?->name,
                    $p->clientSystem?->label,
                    number_format((float) $p->amount, 2, '.', ''),
                    number_format((float) $p->discount_amount, 2, '.', ''),
                    $p->method,
                    $p->reference,
                    $p->covered_due_date->toDateString(),
                    $p->recorder?->name,
                ]);
            }
            fclose($out);
        }, "eaj-sales-{$from}-to-{$to}.csv", ['Content-Type' => 'text/csv']);
    }

    private function filter(Request $request, $query)
    {
        if ($request->filled('system_type_id')) {
            $query->where('system_payments.system_type_id', $request->integer('system_type_id'));
        }
        if ($request->filled('client_id')) {
            $query->where('system_payments.client_id', $request->integer('client_id'));
        }
        if ($request->filled('method')) {
            $query->where('system_payments.method', $request->input('method'));
        }

        return $query;
    }
}
