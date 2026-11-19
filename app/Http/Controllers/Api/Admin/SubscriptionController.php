<?php

namespace App\Http\Controllers\Api\Admin;

use App\Console\Commands\SendSubscriptionReminders;
use App\Http\Controllers\Controller;
use App\Models\ClientSystem;
use App\Models\Expense;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Domains, hosting, VPS… the company pays for, with expiry tracking. */
class SubscriptionController extends Controller
{
    /** ?state=expired|expiring|active|cancelled  ?type=  ?search= */
    public function index(Request $request)
    {
        $request->validate([
            'state' => ['nullable', Rule::in(['all', 'expired', 'expiring', 'active', 'cancelled'])],
            'type' => ['nullable', Rule::in(array_keys(Subscription::TYPES))],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $query = Subscription::with(['client', 'clientSystem.client', 'clientSystem.systemType']);

        match ($request->input('state')) {
            'expired' => $query->expired(),
            'expiring' => $query->expiringSoon(),
            'active' => $query->active(),
            'cancelled' => $query->where('status', 'cancelled'),
            default => null,
        };
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('provider', 'like', "%$s%")
                ->orWhere('account', 'like', "%$s%")
                ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%$s%")->orWhere('store_name', 'like', "%$s%"))
                ->orWhereHas('clientSystem', fn ($c) => $c->where('system_name', 'like', "%$s%")->orWhere('label', 'like', "%$s%")
                    ->orWhereHas('client', fn ($u) => $u->where('name', 'like', "%$s%")->orWhere('store_name', 'like', "%$s%"))));
        }

        $list = $query->orderByRaw("CASE status WHEN 'active' THEN 0 ELSE 1 END")
            ->orderBy('expires_on')->limit(500)->get();

        $active = Subscription::active()->get(['cost', 'billing_cycle', 'paid_by']);

        return response()->json([
            'data' => $list->map(fn (Subscription $s) => $this->present($s)),
            'summary' => [
                'expired' => Subscription::expired()->count(),
                'expiring' => Subscription::expiringSoon()->count(),
                'active' => $active->count(),
                'yearly_cost' => round($active->where('paid_by', 'company')->sum(fn ($s) => $s->yearlyCost()), 2),
                'soon_days' => Subscription::SOON_DAYS,
            ],
            'types' => Subscription::TYPES,
            'cycles' => array_keys(Subscription::CYCLES),
            'alert_days' => config('subscriptions.alert_days'),
            'alert_recipients' => SendSubscriptionReminders::recipients()
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->role->label()])->values(),
            'suggestions' => $this->domainSuggestions(),
            // Pickers for the form — returned here so the page works with only this permission.
            'client_systems' => ClientSystem::with(['client', 'systemType'])->where('status', '!=', 'cancelled')->get()
                ->map(fn (ClientSystem $cs) => [
                    'id' => $cs->id,
                    'display_name' => $cs->displayName(),
                    'client_name' => $cs->client?->store_name ?: $cs->client?->name,
                    'domain' => Subscription::domainFromUrl($cs->login_url),
                ])->sortBy(fn ($o) => mb_strtolower(($o['client_name'] ?? '').' '.$o['display_name']))->values(),
            'clients' => User::where('role', 'customer')->where('approval_status', 'approved')->orderBy('name')
                ->get(['id', 'name', 'store_name'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->store_name ?: $u->name]),
        ]);
    }

    public function store(Request $request)
    {
        $sub = Subscription::create([...$this->validated($request), 'created_by' => $request->user()->id]);

        return response()->json(['data' => $this->present($this->load($sub))], 201);
    }

    public function update(Request $request, Subscription $subscription)
    {
        $subscription->update($this->validated($request, $subscription));

        return response()->json(['data' => $this->present($this->load($subscription->fresh()))]);
    }

    public function destroy(Subscription $subscription)
    {
        $subscription->delete();

        return response()->noContent();
    }

    /**
     * Mark it renewed: moves the expiry forward (default: one cycle past the current
     * expiry) and can record what was paid as a "Hosting & Domains" expense.
     */
    public function renew(Request $request, Subscription $subscription)
    {
        $data = $request->validate([
            'expires_on' => ['nullable', 'date', 'after:'.$subscription->expires_on->toDateString()],
            'amount' => ['nullable', 'numeric', 'gt:0', 'max:9999999999'],
            'record_expense' => ['boolean'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:'.today()->addDay()->toDateString()],
            'method' => ['nullable', Rule::in(['cash', 'gcash', 'maya', 'bank_transfer', 'check', 'other'])],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        $newExpiry = isset($data['expires_on']) ? \Illuminate\Support\Carbon::parse($data['expires_on']) : $subscription->nextExpiryAfter();
        $amount = $data['amount'] ?? $subscription->cost;

        DB::transaction(function () use ($subscription, $data, $newExpiry, $amount, $request) {
            $old = $subscription->expires_on->copy();
            $subscription->update(['expires_on' => $newExpiry, 'status' => 'active']);

            if (($data['record_expense'] ?? false) && $amount) {
                Expense::create([
                    'spent_on' => $data['paid_on'] ?? today()->toDateString(),
                    'category' => 'Hosting & Domains',
                    'description' => "Renewal: {$subscription->displayName()} — until {$newExpiry->format('M j, Y')}",
                    'amount' => $amount,
                    'payee' => $subscription->provider,
                    'method' => $data['method'] ?? null,
                    'reference' => $data['reference'] ?? null,
                    'notes' => "Previous expiry: {$old->format('M j, Y')}",
                    'recorded_by' => $request->user()->id,
                ]);
            }
        });

        return response()->json(['data' => $this->present($this->load($subscription->fresh()))]);
    }

    private function validated(Request $request, ?Subscription $existing = null): array
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(Subscription::TYPES))],
            'name' => ['required', 'string', 'max:255'],
            'provider' => ['nullable', 'string', 'max:255'],
            'client_system_id' => ['nullable', 'integer', 'exists:client_systems,id'],
            'client_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'customer')],
            'paid_by' => ['required', Rule::in(['company', 'client'])],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'billing_cycle' => ['required', Rule::in(array_keys(Subscription::CYCLES))],
            'expires_on' => ['required', 'date'],
            'auto_renew' => ['boolean'],
            'status' => ['nullable', Rule::in(Subscription::STATUSES)],
            'login_url' => ['nullable', 'url', 'max:255'],
            'account' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $data['name'] = trim($data['name']);
        if ($data['type'] === 'domain') {
            // Store domains bare and lowercase so the Client Systems matcher finds them.
            $data['name'] = Subscription::domainFromUrl($data['name']) ?? mb_strtolower($data['name']);
        }
        // A linked client system decides the client.
        if (! empty($data['client_system_id'])) {
            $data['client_id'] = ClientSystem::whereKey($data['client_system_id'])->value('client_id');
        }
        $data['status'] ??= $existing?->status ?? 'active';
        $data['auto_renew'] = (bool) ($data['auto_renew'] ?? false);

        return $data;
    }

    /**
     * Domains found in Client Systems' login URLs that aren't tracked yet,
     * so they can be added in one click.
     */
    private function domainSuggestions(): array
    {
        $tracked = Subscription::where('type', 'domain')->pluck('name')->map(fn ($n) => mb_strtolower($n))->flip();

        return ClientSystem::with(['client', 'systemType'])
            ->where('status', '!=', 'cancelled')
            ->whereNotNull('login_url')->where('login_url', '!=', '')
            ->get()
            ->map(fn (ClientSystem $cs) => [
                'domain' => Subscription::domainFromUrl($cs->login_url),
                'client_system_id' => $cs->id,
                'system_name' => $cs->displayName(),
                'client_name' => $cs->client?->store_name ?: $cs->client?->name,
                'login_url' => $cs->login_url,
            ])
            ->filter(fn ($s) => $s['domain'] && ! $tracked->has($s['domain']))
            ->unique('domain')
            ->values()
            ->all();
    }

    private function load(Subscription $s): Subscription
    {
        return $s->load(['client', 'clientSystem.client', 'clientSystem.systemType']);
    }

    private function present(Subscription $s): array
    {
        $client = $s->client ?? $s->clientSystem?->client;

        return [
            'id' => $s->id,
            'type' => $s->type,
            'type_label' => $s->typeLabel(),
            'name' => $s->name,
            'provider' => $s->provider,
            'client_system' => $s->clientSystem ? [
                'id' => $s->clientSystem->id,
                'display_name' => $s->clientSystem->displayName(),
            ] : null,
            'client' => $client ? ['id' => $client->id, 'name' => $client->name, 'store_name' => $client->store_name] : null,
            'paid_by' => $s->paid_by,
            'cost' => $s->cost === null ? null : (float) $s->cost,
            'yearly_cost' => $s->yearlyCost(),
            'billing_cycle' => $s->billing_cycle,
            'expires_on' => $s->expires_on->toDateString(),
            'next_expiry' => $s->nextExpiryAfter()->toDateString(),
            'days_left' => $s->daysUntilExpiry(),
            'state' => $s->expiryState(),
            'auto_renew' => $s->auto_renew,
            'status' => $s->status,
            'login_url' => $s->login_url,
            'account' => $s->account,
            'notes' => $s->notes,
            'last_alerted_on' => $s->last_alerted_on?->toDateString(),
            'created_at' => $s->created_at,
        ];
    }
}
