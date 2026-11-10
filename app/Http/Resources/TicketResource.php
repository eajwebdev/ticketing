<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_number' => $this->ticket_number,
            'subject' => $this->subject,
            'description' => $this->description,
            'status' => $this->status->value,
            'customer' => new UserResource($this->whenLoaded('customer')),
            'system_type' => new LookupResource($this->whenLoaded('systemType')),
            'client_system' => $this->whenLoaded('clientSystem', fn () => $this->clientSystem ? [
                'id' => $this->clientSystem->id,
                'label' => $this->clientSystem->label,
            ] : null),
            'category' => new LookupResource($this->whenLoaded('category')),
            'urgency' => new LookupResource($this->whenLoaded('urgency')),
            'accepted_by' => new UserResource($this->whenLoaded('acceptedBy')),
            'resolved_by' => new UserResource($this->whenLoaded('resolvedBy')),
            'assignees' => UserResource::collection($this->whenLoaded('assignees')),
            'accepted_at' => $this->accepted_at,
            'resolved_at' => $this->resolved_at,
            'closed_at' => $this->closed_at,
            'first_response_at' => $this->first_response_at,
            'expected_resolution_at' => $this->expected_resolution_at,
            'activities' => ActivityResource::collection($this->whenLoaded('activities')),
            'response_time_minutes' => $this->response_time_minutes,
            'resolution_time_minutes' => $this->resolution_time_minutes,
            'messages_count' => $this->whenCounted('messages'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
