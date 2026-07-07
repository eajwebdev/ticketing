<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\TicketNotification;
use App\Services\TicketService;
use Illuminate\Http\Request;

class AssigneeController extends Controller
{
    public function __construct(private TicketService $service) {}

    public function store(Request $request, Ticket $ticket)
    {
        $this->authorize('manageAssignees', $ticket);

        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
        ]);

        $member = User::findOrFail($data['user_id']);

        // Collaborators must be team members only.
        abort_unless($member->isTeam(), 422, 'Only team members can be added as collaborators.');

        $this->service->addAssignee($ticket, $member, $request->user());
        $this->service->logActivity($ticket, $request->user(), 'collaborator_added', ['user' => $member->name]);

        $member->notify(new TicketNotification('assignment', $ticket, $request->user()));

        return UserResource::collection(
            $ticket->assignees()->withPivot('is_primary')->get()
        );
    }

    public function destroy(Request $request, Ticket $ticket, User $user)
    {
        $this->authorize('manageAssignees', $ticket);

        // Cannot remove the primary assignee.
        $isPrimary = $ticket->assignees()->where('users.id', $user->id)->wherePivot('is_primary', true)->exists();
        abort_if($isPrimary, 422, 'The primary assignee cannot be removed.');

        $ticket->assignees()->detach($user->id);
        $this->service->logActivity($ticket, $request->user(), 'collaborator_removed', ['user' => $user->name]);

        return UserResource::collection(
            $ticket->assignees()->withPivot('is_primary')->get()
        );
    }
}
