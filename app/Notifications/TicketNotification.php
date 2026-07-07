<?php

namespace App\Notifications;

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class TicketNotification extends Notification
{
    use Queueable;

    /**
     * @param  string  $type  one of: mention|assignment|message|status
     */
    public function __construct(
        public string $type,
        public Ticket $ticket,
        public ?User $actor = null,
        public array $extra = [],
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->type,
            'ticket_id' => $this->ticket->id,
            'ticket_number' => $this->ticket->ticket_number,
            'subject' => $this->ticket->subject,
            'actor' => $this->actor ? [
                'id' => $this->actor->id,
                'name' => $this->actor->name,
                'avatar_url' => $this->actor->avatar_url,
            ] : null,
            'message' => $this->buildMessage(),
            'extra' => $this->extra,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    public function broadcastType(): string
    {
        return 'notification';
    }

    protected function buildMessage(): string
    {
        $actor = $this->actor?->name ?? 'Someone';
        $num = $this->ticket->ticket_number;

        return match ($this->type) {
            'mention' => "{$actor} mentioned you on {$num}",
            'assignment' => "{$actor} added you as a collaborator on {$num}",
            'message' => "New message on {$num}",
            'status' => "{$num} was marked ".($this->extra['status'] ?? 'updated'),
            default => "Update on {$num}",
        };
    }
}
