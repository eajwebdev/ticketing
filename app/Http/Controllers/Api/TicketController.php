<?php

namespace App\Http\Controllers\Api;

use App\Enums\TicketStatus;
use App\Events\TicketUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTicketRequest;
use App\Http\Resources\TicketResource;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\TicketNotification;
use App\Services\TicketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TicketController extends Controller
{
    public function __construct(private TicketService $service) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Ticket::query()
            ->with(['customer', 'systemType', 'category', 'urgency', 'acceptedBy', 'assignees'])
            ->withCount('messages')
            ->latest();

        // Role scoping
        if ($user->isCustomer()) {
            $query->where('customer_id', $user->id);
        }

        // Filters
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('system_type')) {
            $query->where('system_type_id', $request->system_type);
        }
        if ($request->filled('urgency')) {
            $query->where('urgency_id', $request->urgency);
        }
        if ($request->filled('category')) {
            $query->where('category_id', $request->category);
        }
        if ($request->filled('assignee')) {
            $query->whereHas('assignees', fn ($q) => $q->where('users.id', $request->assignee));
        }
        if ($request->boolean('mine') && $user->isTeam()) {
            $query->whereHas('assignees', fn ($q) => $q->where('users.id', $user->id));
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('subject', 'like', "%$s%")
                ->orWhere('ticket_number', 'like', "%$s%")
                ->orWhere('description', 'like', "%$s%"));
        }

        return TicketResource::collection($query->paginate(15)->withQueryString());
    }

    public function store(StoreTicketRequest $request)
    {
        $user = $request->user();

        // Only admins may file a ticket on behalf of a client.
        $customerId = $user->isAdmin() && $request->filled('customer_id')
            ? $request->customer_id
            : $user->id;

        $ticket = DB::transaction(function () use ($request, $customerId, $user) {
            $ticket = Ticket::create([
                'ticket_number' => 'PENDING',
                'customer_id' => $customerId,
                'system_type_id' => $request->system_type_id,
                'category_id' => $request->category_id,
                'urgency_id' => $request->urgency_id,
                'subject' => $request->subject,
                'description' => $request->description,
                'status' => TicketStatus::Open,
            ]);

            $ticket->update(['ticket_number' => $ticket->generateNumber()]);

            $this->service->logActivity($ticket, $user, 'created', ['subject' => $ticket->subject]);

            return $ticket;
        });

        $ticket->load(['customer', 'systemType', 'category', 'urgency']);

        return new TicketResource($ticket);
    }

    public function show(Request $request, Ticket $ticket)
    {
        $this->authorize('view', $ticket);

        $ticket->load([
            'customer', 'systemType', 'category', 'urgency', 'acceptedBy', 'resolvedBy',
            'assignees' => fn ($q) => $q->withPivot('is_primary'),
            'activities' => fn ($q) => $q->with('user')->latest(),
        ])->loadCount('messages');

        return new TicketResource($ticket);
    }

    public function update(Request $request, Ticket $ticket)
    {
        $this->authorize('update', $ticket);

        $data = $request->validate([
            'system_type_id' => ['nullable', 'exists:system_types,id'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'urgency_id' => ['nullable', 'exists:urgency_levels,id'],
            'subject' => ['sometimes', 'string', 'max:255'],
        ]);

        $ticket->update($data);
        $this->service->logActivity($ticket, $request->user(), 'updated', $data);

        return new TicketResource($ticket->fresh(['systemType', 'category', 'urgency']));
    }

    public function accept(Request $request, Ticket $ticket)
    {
        $this->authorize('accept', $ticket);

        abort_if(
            ! in_array($ticket->status, [TicketStatus::Open, TicketStatus::Reopened], true),
            422,
            'Only an open ticket can be accepted.'
        );

        $user = $request->user();

        DB::transaction(function () use ($ticket, $user) {
            $ticket->update([
                'status' => TicketStatus::Accepted,
                'accepted_by' => $user->id,
                'accepted_at' => $ticket->accepted_at ?? now(),
            ]);

            $this->service->addAssignee($ticket, $user, $user, isPrimary: true);
            $this->service->logActivity($ticket, $user, 'accepted');
        });

        broadcast(new TicketUpdated($ticket->fresh(), 'accepted'));

        return new TicketResource($ticket->fresh(['acceptedBy', 'assignees']));
    }

    public function resolve(Request $request, Ticket $ticket)
    {
        $this->authorize('resolve', $ticket);

        abort_if(
            ! in_array($ticket->status, [TicketStatus::Accepted, TicketStatus::Reopened], true),
            422,
            'Only an accepted ticket can be resolved.'
        );

        $user = $request->user();
        $ticket->update([
            'status' => TicketStatus::Resolved,
            'resolved_by' => $user->id,
            'resolved_at' => now(),
        ]);

        $this->service->logActivity($ticket, $user, 'resolved');
        broadcast(new TicketUpdated($ticket->fresh(), 'resolved'));

        // notify customer
        $ticket->customer->notify(new TicketNotification('status', $ticket, $user, ['status' => 'resolved']));

        return new TicketResource($ticket->fresh(['resolvedBy']));
    }

    /**
     * The assignee (or admin) commits to an expected fix date — shown to the client.
     */
    public function setEta(Request $request, Ticket $ticket)
    {
        $this->authorize('manageAssignees', $ticket);

        $data = $request->validate([
            'expected_resolution_at' => ['required', 'date', 'after:now'],
        ]);

        $ticket->update(['expected_resolution_at' => $data['expected_resolution_at']]);

        $this->service->logActivity($ticket, $request->user(), 'eta_set', [
            'expected_resolution_at' => $ticket->expected_resolution_at->toIso8601String(),
        ]);

        broadcast(new TicketUpdated($ticket->fresh(), 'eta'));

        // Let the client know when to expect the fix.
        $ticket->customer->notify(new TicketNotification('eta', $ticket, $request->user(), [
            'expected_resolution_at' => $ticket->expected_resolution_at->toIso8601String(),
        ]));

        return new TicketResource($ticket->fresh(['activities' => fn ($q) => $q->with('user')->latest()]));
    }

    public function reopen(Request $request, Ticket $ticket)
    {
        $this->authorize('reopen', $ticket);

        abort_if(
            ! in_array($ticket->status, [TicketStatus::Resolved, TicketStatus::Closed], true),
            422,
            'Only a resolved or closed ticket can be reopened.'
        );

        $user = $request->user();
        $ticket->update([
            'status' => TicketStatus::Reopened,
            'resolved_at' => null,
            'resolved_by' => null,
            'closed_at' => null,
        ]);

        $this->service->logActivity($ticket, $user, 'reopened');
        broadcast(new TicketUpdated($ticket->fresh(), 'reopened'));

        // notify assignees
        foreach ($ticket->assignees as $assignee) {
            $assignee->notify(new TicketNotification('status', $ticket, $user, ['status' => 'reopened']));
        }

        return new TicketResource($ticket->fresh());
    }
}
