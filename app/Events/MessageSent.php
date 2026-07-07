<?php

namespace App\Events;

use App\Http\Resources\MessageResource;
use App\Models\TicketMessage;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public TicketMessage $message)
    {
        $this->message->loadMissing(['user', 'attachments', 'mentions.mentionedUser', 'replyTo.user']);
    }

    public function broadcastOn(): array
    {
        return [new PresenceChannel('ticket.'.$this->message->ticket_id)];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    public function broadcastWith(): array
    {
        $payload = (new MessageResource($this->message))->resolve();

        // The presence channel includes the customer — never leak internal-note quotes.
        if (($payload['reply_to']['is_internal'] ?? false) === true) {
            $payload['reply_to'] = null;
        }

        return ['message' => $payload];
    }
}
