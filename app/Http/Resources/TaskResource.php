<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $person = fn ($u) => $u ? ['id' => $u->id, 'name' => $u->name, 'avatar_url' => $u->avatar_url, 'role_label' => $u->role->label()] : null;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->priority,
            'type' => $this->type,
            'position' => $this->position,
            'due_date' => $this->due_date?->toDateString(),
            'is_overdue' => $this->isOverdue(),
            'completed_at' => $this->completed_at,
            'assignee' => $this->whenLoaded('assignee', fn () => $person($this->assignee)),
            'creator' => $this->whenLoaded('creator', fn () => $person($this->creator)),
            'client' => $this->whenLoaded('client', fn () => $this->client ? [
                'id' => $this->client->id, 'name' => $this->client->name, 'store_name' => $this->client->store_name,
            ] : null),
            'client_system' => $this->whenLoaded('clientSystem', fn () => $this->clientSystem ? [
                'id' => $this->clientSystem->id, 'display_name' => $this->clientSystem->displayName(),
            ] : null),
            'ticket' => $this->whenLoaded('ticket', fn () => $this->ticket ? [
                'id' => $this->ticket->id, 'ticket_number' => $this->ticket->ticket_number, 'subject' => $this->ticket->subject,
            ] : null),
            'can_edit' => $request->user() ? $this->resource->canBeEditedBy($request->user()) : false,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
