<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\ClientSystemResource;
use App\Http\Resources\SystemPaymentResource;
use App\Models\ClientSystem;
use App\Models\SystemPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class ClientSystemController extends Controller
{
    /** Admins, plus staff the admin has granted credential access to. */
    public function index(Request $request)
    {
        abort_unless($request->user()->canAccessClientSystems(), 403);

        $query = ClientSystem::with(['client', 'systemType'])
            ->addSelect(['last_paid_at' => SystemPayment::select('paid_at')
                ->whereColumn('client_system_id', 'client_systems.id')
                ->latest('paid_at')->limit(1)]);

        match ($request->input('state')) {
            'overdue' => $query->overdue(),
            'due_soon' => $query->dueSoon(),
            'active' => $query->active(),
            'inactive' => $query->whereIn('status', ['paused', 'cancelled']),
            default => null,
        };

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }
        if ($request->filled('system_type_id')) {
            $query->where('system_type_id', $request->integer('system_type_id'));
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('label', 'like', "%$s%")
                ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%$s%")
                    ->orWhere('store_name', 'like', "%$s%")
                    ->orWhereRaw('LOWER(CAST(business_names AS CHAR)) LIKE ?', ['%'.mb_strtolower($s).'%'])
                    ->orWhere('email', 'like', "%$s%"))
                ->orWhereHas('systemType', fn ($t) => $t->where('name', 'like', "%$s%")));
        }

        // Active ones first, soonest due on top.
        $query->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END")
            ->orderBy('next_due_date');

        $perPage = min($request->integer('per_page', 50), 200);

        return ClientSystemResource::collection($query->paginate($perPage)->withQueryString());
    }

    /** Header counters + upcoming list, used by the Client Systems page and the dashboard. */
    public function overview(Request $request)
    {
        abort_unless($request->user()->hasPermission(\App\Support\Permissions::BILLING), 403);

        $active = ClientSystem::active()->get(['amount', 'billing_cycle']);

        return [
            'overdue' => ClientSystem::overdue()->count(),
            'overdue_amount' => (float) ClientSystem::overdue()->sum('amount'),
            'due_soon' => ClientSystem::dueSoon()->count(),
            'due_soon_amount' => (float) ClientSystem::dueSoon()->sum('amount'),
            'active' => $active->count(),
            'mrr' => round($active->sum(fn ($s) => $s->monthlyValue()), 2),
            'sales_this_month' => (float) SystemPayment::whereBetween('paid_at', [
                today()->startOfMonth()->toDateString(), today()->endOfMonth()->toDateString(),
            ])->sum('amount'),
            'attention' => ClientSystemResource::collection(
                ClientSystem::with(['client', 'systemType'])->active()
                    ->whereDate('next_due_date', '<=', today()->addDays(ClientSystem::DUE_SOON_DAYS))
                    ->orderBy('next_due_date')->limit(8)->get()
            ),
        ];
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;

        $system = ClientSystem::create($data);

        return (new ClientSystemResource($system->load(['client', 'systemType'])))
            ->response()->setStatusCode(201);
    }

    public function update(Request $request, ClientSystem $clientSystem)
    {
        $data = $this->validated($request, $clientSystem);

        // A blank password on edit means "keep the current one".
        if (! filled($data['password'] ?? null) && ! $request->boolean('clear_password')) {
            unset($data['password']);
        }

        $clientSystem->fill($data);
        if ($clientSystem->isDirty('next_due_date')) {
            $clientSystem->billing_anchor_day = $clientSystem->next_due_date->day;
            $clientSystem->last_reminded_on = null;
        }
        $clientSystem->save();

        return new ClientSystemResource($clientSystem->fresh(['client', 'systemType']));
    }

    public function destroy(ClientSystem $clientSystem)
    {
        abort_if($clientSystem->payments()->exists(), 422,
            'This system has recorded sales. Set it to Cancelled instead so your sales history is kept.');

        $clientSystem->delete();

        return response()->noContent();
    }

    /**
     * Mark the current due date as paid: records a sale and rolls the due date
     * forward — one cycle, or several when the client pays in advance.
     */
    public function pay(Request $request, ClientSystem $clientSystem)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0', 'max:9999999999'],
            'cycles' => ['sometimes', 'integer', 'min:1', 'max:24'],
            'paid_at' => ['required', 'date', 'before_or_equal:today'],
            'method' => ['required', Rule::in(SystemPayment::METHODS)],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $payment = DB::transaction(function () use ($data, $clientSystem, $request) {
            $system = ClientSystem::lockForUpdate()->findOrFail($clientSystem->id);
            $cycles = (int) ($data['cycles'] ?? 1);
            $covered = $system->next_due_date->copy();
            $next = $system->dueDateAfterCycles($covered, $cycles);

            $payment = SystemPayment::create([
                ...$data,
                'cycles' => $cycles,
                'discount_amount' => $system->discountAmount((float) $data['amount'], $cycles),
                'client_system_id' => $system->id,
                'client_id' => $system->client_id,
                'system_type_id' => $system->system_type_id,
                'covered_due_date' => $covered,
                'next_due_date' => $next,
                'recorded_by' => $request->user()->id,
            ]);

            $system->update(['next_due_date' => $next, 'last_reminded_on' => null]);

            return $payment;
        });

        return response()->json([
            'payment' => new SystemPaymentResource($payment),
            'system' => new ClientSystemResource($clientSystem->fresh(['client', 'systemType'])),
        ], 201);
    }

    public function payments(ClientSystem $clientSystem)
    {
        return SystemPaymentResource::collection(
            $clientSystem->payments()->with('recorder')->get()
        );
    }

    /** Decrypted login — admins always, staff only when an admin has allowed it. Every view is logged. */
    public function credentials(Request $request, ClientSystem $clientSystem)
    {
        $user = $request->user();
        abort_unless($user->canViewCredentials(), 403, 'You are not allowed to view system credentials.');

        Log::info('Client system credentials viewed', [
            'client_system_id' => $clientSystem->id,
            'viewer_id' => $user->id,
            'viewer' => $user->email,
            'ip' => $request->ip(),
        ]);

        return [
            'login_url' => $clientSystem->login_url,
            'username' => $clientSystem->username,
            'password' => $clientSystem->password,
        ];
    }

    private function validated(Request $request, ?ClientSystem $existing = null): array
    {
        $data = $request->validate([
            'client_id' => ['required', Rule::exists('users', 'id')->where('role', Role::Customer->value)],
            'system_type_id' => ['required', 'exists:system_types,id'],
            'label' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0', 'max:9999999999'],
            // Month-to-month price, used to show the lock-in discount on longer cycles.
            'regular_monthly_rate' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'billing_cycle' => ['required', Rule::in(array_keys(ClientSystem::CYCLES))],
            'next_due_date' => ['required', 'date'],
            'started_on' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(ClientSystem::STATUSES)],
            'login_url' => ['nullable', 'string', 'max:500'],
            'username' => ['nullable', 'string', 'max:500'],
            'password' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $data['next_due_date'] = Carbon::parse($data['next_due_date'])->startOfDay();
        // Blank start date: new systems start on their first due date; edits keep what's saved.
        if (empty($data['started_on'])) {
            $data['started_on'] = $existing?->started_on ?? $data['next_due_date']->copy();
        }
        // A regular rate only means something for multi-month (lock-in) plans.
        if ($data['billing_cycle'] === 'monthly') {
            $data['regular_monthly_rate'] = null;
        }

        return $data;
    }
}
