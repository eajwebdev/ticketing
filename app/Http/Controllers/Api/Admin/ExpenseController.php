<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    /**
     * Expenses for one month (default: this month) with a per-category summary.
     * ?month=YYYY-MM  ?category=  ?search=
     */
    public function index(Request $request)
    {
        $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'category' => ['nullable', 'string', 'max:100'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $month = $request->filled('month') ? Carbon::createFromFormat('Y-m', $request->month)->startOfMonth() : today()->startOfMonth();
        $range = [$month->toDateString(), $month->copy()->endOfMonth()->toDateString()];

        $base = Expense::whereBetween('spent_on', $range);
        $prevTotal = (float) Expense::whereBetween('spent_on', [
            $month->copy()->subMonthNoOverflow()->toDateString(),
            $month->copy()->subMonthNoOverflow()->endOfMonth()->toDateString(),
        ])->sum('amount');

        $byCategory = (clone $base)->selectRaw('category, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('category')->orderByDesc('total')->get()
            ->map(fn ($r) => ['category' => $r->category, 'total' => round((float) $r->total, 2), 'count' => (int) $r->count]);

        $list = (clone $base)->with('recorder:id,name')
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->category))
            ->when($request->filled('search'), function ($q) use ($request) {
                $s = $request->search;
                $q->where(fn ($w) => $w->where('description', 'like', "%$s%")
                    ->orWhere('payee', 'like', "%$s%")
                    ->orWhere('reference', 'like', "%$s%"));
            })
            ->orderByDesc('spent_on')->orderByDesc('id')
            ->limit(500)->get();

        $total = (float) (clone $base)->sum('amount');

        return response()->json([
            'month' => $month->format('Y-m'),
            'data' => $list->map(fn (Expense $e) => $this->present($e)),
            'summary' => [
                'total' => round($total, 2),
                'count' => (clone $base)->count(),
                'prev_total' => round($prevTotal, 2),
                'by_category' => $byCategory,
            ],
            'categories' => array_values(array_unique([
                ...Expense::CATEGORIES,
                ...Expense::query()->distinct()->orderBy('category')->pluck('category')->all(),
            ])),
        ]);
    }

    public function store(Request $request)
    {
        $expense = Expense::create([...$this->validated($request), 'recorded_by' => $request->user()->id]);

        return response()->json(['data' => $this->present($expense->load('recorder:id,name'))], 201);
    }

    public function update(Request $request, Expense $expense)
    {
        $expense->update($this->validated($request));

        return response()->json(['data' => $this->present($expense->fresh('recorder:id,name'))]);
    }

    public function destroy(Expense $expense)
    {
        $expense->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'spent_on' => ['required', 'date', 'before_or_equal:'.today()->addYear()->toDateString()],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'payee' => ['nullable', 'string', 'max:255'],
            'method' => ['nullable', 'string', Rule::in(['cash', 'gcash', 'maya', 'bank_transfer', 'check', 'other'])],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $data['category'] = trim($data['category']);

        return $data;
    }

    private function present(Expense $e): array
    {
        return [
            'id' => $e->id,
            'spent_on' => $e->spent_on->toDateString(),
            'category' => $e->category,
            'description' => $e->description,
            'amount' => (float) $e->amount,
            'payee' => $e->payee,
            'method' => $e->method,
            'reference' => $e->reference,
            'notes' => $e->notes,
            'recorded_by' => $e->recorder ? ['id' => $e->recorder->id, 'name' => $e->recorder->name] : null,
            // Set when this came from "Mark paid" on a payout (deleting the latest one undoes it).
            'payout_id' => $e->payout_id,
            'created_at' => $e->created_at,
        ];
    }
}
