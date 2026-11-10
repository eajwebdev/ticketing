<?php

namespace App\Policies;

use App\Models\Ticket;
use App\Models\User;
use App\Support\Permissions;

class TicketPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // scoped in controller query
    }

    public function view(User $user, Ticket $ticket): bool
    {
        return $user->hasPermission(Permissions::TICKETS) || $ticket->isParticipant($user);
    }

    public function create(User $user): bool
    {
        return true; // customers create tickets; team can too on behalf
    }

    public function update(User $user, Ticket $ticket): bool
    {
        return $user->hasPermission(Permissions::TICKETS);
    }

    public function accept(User $user, Ticket $ticket): bool
    {
        return $user->hasPermission(Permissions::TICKETS);
    }

    public function resolve(User $user, Ticket $ticket): bool
    {
        // any assignee/collaborator or admin
        return $user->isAdmin() || $ticket->isParticipant($user) && $user->isTeam();
    }

    public function reopen(User $user, Ticket $ticket): bool
    {
        return $user->hasPermission(Permissions::TICKETS) || $ticket->customer_id === $user->id;
    }

    public function manageAssignees(User $user, Ticket $ticket): bool
    {
        // any team member who is on the ticket, or admin
        return $user->isAdmin() || ($user->isTeam() && $ticket->isParticipant($user));
    }

    public function postMessage(User $user, Ticket $ticket): bool
    {
        return $ticket->isParticipant($user);
    }

    public function postInternalNote(User $user, Ticket $ticket): bool
    {
        return $user->isTeam();
    }
}
