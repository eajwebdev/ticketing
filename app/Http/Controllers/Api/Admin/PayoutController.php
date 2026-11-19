<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientSystem;
use App\Models\Expense;
use App\Models\Payout;
use App\Models\SystemPayment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Scheduled payments to team members and outside people (maintenance, marketing, commissions…). */
class PayoutController extends Controller
{
    public const RELATIONS = ['payeeUser:id,name,avatar_path', 'clientSystem.client', 'clientSystem.systemType', 'latestPayment'];

    public function index()
    {
        $all = Payout::with(self::RELATIONS)
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END")
            ->orderBy('next_due_date')->get();

        return response()->json([
            'data' => $all->map->present()->values(),
            'summary' => self::summary(),
            // Form pickers.
            'team' => User::team()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'role'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'role' => $u->role->label()]),
            'client_systems' => ClientSystem::with(['client', 'systemType'])->where('status', '!=', 'cancelled')->get()
                ->map(fn (ClientSystem $cs) => [
                    'id' => $cs->id, 'display_name' => $cs->displayName(),
                    'client_name' => $cs->client?->store_name ?: $cs->client?->name,
                    'amount' => (float) $cs->amount, 'billing_cycle' => $cs->billing_cycle,
                    'setup_fee' => $cs->setup_fee === null ? null : (float) $cs->setup_fee,
                ])->sortBy(fn ($o) => mb_strtolower(($o['client_name'] ?? '').' '.$o['display_name']))->values(),
            'categories' => array_values(array_unique([
                ...Payout::CATEGORIES,
                ...Payout::query()->distinct()->orderBy('category')->pluck('category')->all(),
            ])),
        ]);
    }

    /** Header numbers — shared with the dashboard. */
    public static function summary(): array
    {
        $monthRange = [today()->startOfMonth()->toDateString(), today()->endOfMonth()->toDateString()];
        $recurring = Payout::active()->recurring()->get(['amount', 'cycle', 'category']);
        $monthly = round($recurring->sum(fn ($p) => $p->monthlyValue()), 2);
        $mrr = round(ClientSystem::active()->get(['amount', 'billing_cycle'])->sum(fn ($s) => $s->monthlyValue()), 2);

        return [
            'monthly_total' => $monthly,
            'by_category' => $recurring->groupBy('category')
                ->map(fn ($g, $cat) => ['category' => $cat, 'monthly' => round($g->sum(fn ($p) => $p->monthlyValue()), 2), 'count' => $g->count()])
                ->sortByDesc('monthly')->values(),
            'mrr' => $mrr,
            'net_mrr' => round($mrr - $monthly, 2),
            'overdue_count' => Payout::overdue()->count(),
            'overdue_amount' => round((float) Payout::overdue()->sum('amount'), 2),
            'due_soon_count' => Payout::dueSoon()->count(),
            'due_soon_amount' => round((float) Payout::dueSoon()->sum('amount'), 2),
            'paid_this_month' => round((float) Expense::whereNotNull('payout_id')->whereBetween('spent_on', $monthRange)->sum('amount'), 2),
            'active_count' => Payout::active()->count(),
        ];
    }

    public function store(Request $request)
    {
        $payout = Payout::create([...$this->validated($request), 'created_by' => $request->user()->id]);

        return response()->json(['data' => $payout->load(self::RELATIONS)->present()], 201);
    }

    public function update(Request $request, Payout $payout)
    {
        $payout->fill($this->validated($request, $payout));
        if ($payout->isDirty('next_due_date')) {
            $payout->anchor_day = $payout->next_due_date->day;
        }
        $payout->save();

        return response()->json(['data' => $payout->fresh(self::RELATIONS)->present()]);
    }

    /** Payment history stays in Expenses (unlinked) — it was real money spent. */
    public function destroy(Payout $payout)
    {
        $payout->delete();

        return response()->noContent();
    }

    /**
     * Mark paid: records an Expense and moves the due date forward (one or more cycles).
     * A one-time payout is completed.
     */
    public function pay(Request $request, Payout $payout)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'cycles' => ['sometimes', 'integer', 'min:1', 'max:12'],
            'paid_on' => ['required', 'date', 'before_or_equal:'.today()->addDay()->toDateString()],
            'method' => ['nullable', Rule::in(SystemPayment::METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $expense = DB::transaction(function () use ($payout, $data, $request) {
            $p = Payout::lockForUpdate()->findOrFail($payout->id);
            abort_if($p->status === 'completed', 422, 'This one-time payout is already paid.');

            $cycles = $p->isOnce() ? 1 : (int) ($data['cycles'] ?? 1);
            $covered = $p->next_due_date->copy();
            $period = $p->isOnce() ? 'one-time'
                : ($cycles > 1 ? $covered->format('M Y').' + '.($cycles - 1).' more' : $covered->format('M Y'));

            $expense = Expense::create([
                'spent_on' => $data['paid_on'],
                'category' => $p->category,
                'description' => trim(($p->description ?: $p->category).' — '.$p->payee_name." ({$period})"),
                'amount' => $data['amount'],
                'payee' => $p->payee_name,
                'method' => $data['method'] ?? $p->payout_method,
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $request->user()->id,
                'payout_id' => $p->id,
                'client_system_id' => $p->client_system_id,
                'covered_due_date' => $covered,
            ]);

            $p->update($p->isOnce()
                ? ['status' => 'completed']
                : ['next_due_date' => $p->dueDateAfterCycles($covered, $cycles)]);

            return $expense;
        });

        return response()->json([
            'expense_id' => $expense->id,
            'data' => $payout->fresh(self::RELATIONS)->present(),
        ], 201);
    }

    public function payments(Payout $payout)
    {
        return response()->json([
            'data' => $payout->payments()->with('recorder:id,name')->limit(100)->get()->map(fn (Expense $e) => [
                'id' => $e->id,
                'amount' => (float) $e->amount,
                'spent_on' => $e->spent_on->toDateString(),
                'covered_due_date' => $e->covered_due_date?->toDateString(),
                'method' => $e->method,
                'reference' => $e->reference,
                'description' => $e->description,
                'recorded_by' => $e->recorder?->name,
            ]),
        ]);
    }

    /** Undo a payment. If it was the latest one, the due date goes back (see Expense::booted). */
    public function voidPayment(Payout $payout, Expense $expense)
    {
        abort_unless($expense->payout_id === $payout->id, 404);
        $expense->delete();

        return response()->json(['data' => $payout->fresh(self::RELATIONS)->present()]);
    }

    private function validated(Request $request, ?Payout $existing = null): array
    {
        $data = $request->validate([
            'payee_kind' => ['required', Rule::in(Payout::PAYEE_KINDS)],
            'payee_user_id' => ['nullable', 'required_if:payee_kind,team', 'integer',
                Rule::exists('users', 'id')->whereNot('role', 'customer')],
            'payee_name' => ['nullable', 'required_if:payee_kind,external', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999'],
            'cycle' => ['required', Rule::in(array_keys(Payout::CYCLES))],
            'next_due_date' => ['required', 'date'],
            'client_system_id' => ['nullable', 'integer', 'exists:client_systems,id'],
            'status' => ['sometimes', Rule::in(Payout::STATUSES)],
            'payout_method' => ['nullable', Rule::in(SystemPayment::METHODS)],
            'payout_account' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [
            'payee_user_id.required_if' => 'Pick the team member.',
            'payee_name.required_if' => 'Enter who gets paid.',
        ]);

        if ($data['payee_kind'] === 'team') {
            $data['payee_name'] = User::whereKey($data['payee_user_id'])->value('name');
        } else {
            $data['payee_user_id'] = null;
            $data['payee_name'] = trim($data['payee_name']);
        }
        $data['category'] = trim($data['category']);
        $data['status'] ??= $existing?->status ?? 'active';

        return $data;
    }
}
