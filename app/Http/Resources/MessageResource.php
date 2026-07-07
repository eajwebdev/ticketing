<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_id' => $this->ticket_id,
            'body' => $this->body,
            'is_internal' => $this->is_internal,
            'user' => new UserResource($this->whenLoaded('user')),
            'attachments' => AttachmentResource::collection($this->whenLoaded('attachments')),
            'mentions' => $this->whenLoaded('mentions', fn () => $this->mentions->map(fn ($m) => [
                'id' => $m->mentioned_user_id,
                'name' => $m->mentionedUser?->name,
            ])),
            'created_at' => $this->created_at,
        ];
    }
}
