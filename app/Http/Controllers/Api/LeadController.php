<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\LeadResource;
use App\Http\Resources\UserResource;
use App\Models\Lead;
use App\Models\User;
use App\Notifications\WorkNotification;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LeadController extends Controller
{
    private const RELATIONS = ['owner', 'systemType', 'convertedClient'];

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Lead::with(self::RELATIONS)->orderByRaw('next_follow_up IS NULL')->orderBy('next_follow_up')->latest('id');

        if ($request->input('owner') === 'me') {
            $query->where('owner_id', $user->id);
        } elseif ($request->filled('owner') && $request->input('owner') !== 'all') {
            $query->where('owner_id', $request->integer('owner'));
        }
        foreach (['source', 'stage', 'system_type_id'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, $request->input($f));
            }
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('business_name', 'like', "%$s%")
                ->orWhere('contact_person', 'like', "%$s%")
                ->orWhere('email', 'like', "%$s%")
                ->orWhere('phone', 'like', "%$s%"));
        }

        $monthStart = today()->startOfMonth();
        $closedThisMonth = Lead::whereIn('stage', ['won', 'lost'])->where('updated_at', '>=', $monthStart);
        $wonThisMonth = (clone $closedThisMonth)->where('stage', 'won');
        $closedCount = (clone $closedThisMonth)->count();

        return LeadResource::collection($query->limit(500)->get())->additional([
            'summary' => [
                'open' => Lead::whereIn('stage', Lead::OPEN_STAGES)->count(),
                'pipeline_value' => (float) Lead::whereIn('stage', Lead::OPEN_STAGES)->sum('estimated_value'),
                'pipeline_monthly' => (float) Lead::whereIn('stage', Lead::OPEN_STAGES)->sum('monthly_fee'),
                'won_this_month' => (clone $wonThisMonth)->count(),
                'won_value_this_month' => (float) (clone $wonThisMonth)->sum('estimated_value'),
                'won_monthly_this_month' => (float) (clone $wonThisMonth)->sum('monthly_fee'),
                'win_rate_this_month' => $closedCount ? round((clone $wonThisMonth)->count() / $closedCount * 100) : null,
                'follow_ups_due' => Lead::whereIn('stage', Lead::OPEN_STAGES)->whereDate('next_follow_up', '<=', today())->count(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;
        $data['owner_id'] ??= $request->user()->id;

        $lead = Lead::create($data);
        $this->notifyOwner($lead, $request->user());

        return (new LeadResource($lead->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    public function update(Request $request, Lead $lead)
    {
        $before = $lead->owner_id;
        $data = $this->validated($request, $lead);
        if (array_key_exists('next_follow_up', $data)) {
            $data['last_reminded_on'] = null;
        }
        $lead->update($data);

        if ($lead->owner_id && $lead->owner_id !== $before) {
            $this->notifyOwner($lead, $request->user());
        }

        return new LeadResource($lead->fresh(self::RELATIONS));
    }

    public function move(Request $request, Lead $lead)
    {
        $data = $request->validate([
            'stage' => ['required', Rule::in(Lead::STAGES)],
            'lost_reason' => ['nullable', 'string', 'max:255'],
        ]);
        $lead->update($data);

        return new LeadResource($lead->fresh(self::RELATIONS));
    }

    /** Won the deal: create the client account from the lead (one click, temp password). */
    public function convert(Request $request, Lead $lead)
    {
        abort_if($lead->converted_client_id, 422, 'This lead was already converted.');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        ]);

        $tempPassword = Str::password(12);
        $client = DB::transaction(function () use ($lead, $data, $request, $tempPassword) {
            $client = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $tempPassword,
                'role' => Role::Customer,
                'store_name' => $lead->business_name,
                'business_types' => $lead->business_type ? [$lead->business_type] : null,
                'contact_person' => $lead->contact_person,
                'phone' => $lead->phone,
                'notes' => $lead->notes,
                'approval_status' => 'approved',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);
            $lead->update(['stage' => 'won', 'converted_client_id' => $client->id, 'converted_at' => now()]);

            return $client;
        });

        return response()->json([
            'lead' => new LeadResource($lead->fresh(self::RELATIONS)),
            'client' => new UserResource($client),
            'temporary_password' => $tempPassword,
        ], 201);
    }

    public function destroy(Lead $lead)
    {
        $lead->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?Lead $lead = null): array
    {
        return $request->validate([
            'business_name' => [$lead ? 'sometimes' : 'required', 'string', 'max:255'],
            'contact_person' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'business_type' => ['sometimes', 'nullable', 'string', 'max:255'],
            'source' => ['sometimes', Rule::in(Lead::SOURCES)],
            'system_type_id' => ['sometimes', 'nullable', 'exists:system_types,id'],
            'estimated_value' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999999999'],
            'monthly_fee' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999999999'],
            'stage' => ['sometimes', Rule::in(Lead::STAGES)],
            'owner_id' => ['sometimes', 'nullable', Rule::exists('users', 'id')->whereIn('role', Role::teamValues())],
            'next_follow_up' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'lost_reason' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
    }

    private function notifyOwner(Lead $lead, User $actor): void
    {
        if (! $lead->owner_id || $lead->owner_id === $actor->id) {
            return;
        }
        Notify::safely([$lead->owner], new WorkNotification(
            'lead_assigned',
            "{$actor->name} gave you a lead: {$lead->business_name}",
            "/app/leads?lead={$lead->id}",
            ['lead_id' => $lead->id],
        ));
    }
}
