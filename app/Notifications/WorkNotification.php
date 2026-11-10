<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

/**
 * Generic in-app notification for tasks and leads.
 * The SPA opens `link` when the notification is clicked.
 */
class WorkNotification extends Notification
{
    use Queueable;

    /**
     * @param  string  $type  task_assigned | task_due | lead_assigned | lead_follow_up
     */
    public function __construct(
        public string $type,
        public string $message,
        public string $link,
        public array $extra = [],
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        return ['type' => $this->type, 'message' => $this->message, 'link' => $this->link, ...$this->extra];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    public function broadcastType(): string
    {
        return 'notification';
    }
}
