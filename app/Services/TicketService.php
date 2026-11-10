<?php

namespace App\Services;

use App\Models\Ticket;
use App\Models\TicketActivity;
use App\Models\User;

class TicketService
{
    public function logActivity(Ticket $ticket, ?User $user, string $action, array $meta = []): void
    {
        TicketActivity::create([
            'ticket_id' => $ticket->id,
            'user_id' => $user?->id,
            'action' => $action,
            'meta' => $meta ?: null,
        ]);
    }

    public function addAssignee(Ticket $ticket, User $user, ?User $addedBy = null, bool $isPrimary = false): void
    {
        if ($ticket->assignees()->where('users.id', $user->id)->exists()) {
            if ($isPrimary) {
                $ticket->assignees()->updateExistingPivot($user->id, ['is_primary' => true]);
            }

            return;
        }

        $ticket->assignees()->attach($user->id, [
            'is_primary' => $isPrimary,
            'added_by' => $addedBy?->id,
        ]);
    }

    /**
     * Team members who may be @mentioned on this ticket = agents/admins currently assigned.
     */
    /**
     * Who a team member may @mention on this ticket:
     *  - the assigned agents/admins, and
     *  - the client who submitted the ticket (so we can loop them in directly).
     */
    public function mentionableUsers(Ticket $ticket)
    {
        $team = $ticket->assignees()
            ->whereIn('role', \App\Enums\Role::teamValues())
            ->get();

        $customer = $ticket->customer()->first();

        return $customer
            ? $team->push($customer)->unique('id')->values()
            : $team;
    }
}
