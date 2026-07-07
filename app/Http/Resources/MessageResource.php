<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Quoted reply — hidden entirely from customers when the original is an internal note.
        $reply = $this->relationLoaded('replyTo') ? $this->replyTo : null;
        if ($reply && $reply->is_internal && ! ($request->user()?->isTeam() ?? true)) {
            $reply = null;
        }

        return [
            'id' => $this->id,
            'ticket_id' => $this->ticket_id,
            'body' => $this->body,
            'is_internal' => $this->is_internal,
            'reply_to' => $reply ? [
                'id' => $reply->id,
                'body' => \Illuminate\Support\Str::limit((string) $reply->body, 140) ?: '📎 Attachment',
                'user' => ['id' => $reply->user?->id, 'name' => $reply->user?->name],
                'is_internal' => $reply->is_internal,
            ] : null,
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
