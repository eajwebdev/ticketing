<?php

namespace App\Notifications;

use App\Models\ClientSystem;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class BillingNotification extends Notification
{
    use Queueable;

    /**
     * @param  string  $type  billing_due | billing_due_today | billing_overdue
     */
    public function __construct(
        public string $type,
        public ClientSystem $system,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        $client = $this->system->client;

        return [
            'type' => $this->type,
            'client_system_id' => $this->system->id,
            'client_name' => $client?->store_name ?: $client?->name,
            'system_name' => $this->system->displayName(),
            'amount' => (float) $this->system->amount,
            'due_date' => $this->system->next_due_date->toDateString(),
            'days' => $this->system->daysUntilDue(),
            'message' => $this->buildMessage(),
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
        $client = $this->system->client?->store_name ?: $this->system->client?->name ?: 'A client';
        $system = $this->system->displayName();
        $amount = '₱'.number_format((float) $this->system->amount, 2);
        $days = $this->system->daysUntilDue();

        return match ($this->type) {
            'billing_overdue' => "{$client} — {$system} is OVERDUE by ".abs($days).' '.str('day')->plural(abs($days))." ({$amount})",
            'billing_due_today' => "{$client} — {$system} is due TODAY ({$amount})",
            default => "{$client} — {$system} is due in {$days} ".str('day')->plural($days)." ({$amount})",
        };
    }
}
