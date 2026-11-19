<?php

namespace App\Notifications;

use App\Models\Subscription;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** "juanlaundry.com (Domain) expires in 7 days" — emailed + in-app to Owner/Admin users. */
class SubscriptionExpiryNotification extends Notification
{
    use Queueable;

    /**
     * @param  string  $type  subscription_expiring | subscription_expires_today | subscription_expired
     */
    public function __construct(
        public string $type,
        public Subscription $subscription,
    ) {}

    public function via(object $notifiable): array
    {
        // Database first, so the bell still has it if the mail server or Reverb is down.
        return ['database', 'mail', 'broadcast'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $s = $this->subscription;
        $days = $s->daysUntilExpiry();

        $mail = (new MailMessage)
            ->subject($this->subject())
            ->greeting($this->type === 'subscription_expired' ? 'Action needed — this has expired' : 'Renewal reminder')
            ->line($this->buildMessage())
            ->line('**What:** '.$s->name.' — '.$s->typeLabel())
            ->line('**Expiry date:** '.$s->expires_on->format('F j, Y').($days >= 0 ? " ({$days} ".str('day')->plural($days).' left)' : ''));

        if ($s->provider) {
            $mail->line('**Provider:** '.$s->provider.($s->account ? " (account: {$s->account})" : ''));
        }
        if ($client = $this->clientLabel()) {
            $mail->line('**Used by:** '.$client);
        }
        if ($s->cost !== null) {
            $mail->line('**Renewal cost:** ₱'.number_format((float) $s->cost, 2).' / '.str_replace('_', ' ', $s->billing_cycle));
        }
        $mail->line($s->auto_renew
            ? 'Auto-renew is ON — please make sure the card or balance on the account can cover it.'
            : 'Auto-renew is OFF — it has to be renewed manually.');

        if ($s->login_url) {
            $mail->action('Open provider', $s->login_url);
        } else {
            $mail->action('View subscriptions', $this->appLink());
        }

        return $mail->line('Once renewed, click "Renew" on it in the Subscriptions page so these reminders stop: '.$this->appLink());
    }

    public function toArray(object $notifiable): array
    {
        $s = $this->subscription;

        return [
            'type' => $this->type,
            'subscription_id' => $s->id,
            'name' => $s->name,
            'subscription_type' => $s->type,
            'expires_on' => $s->expires_on->toDateString(),
            'days' => $s->daysUntilExpiry(),
            'message' => $this->buildMessage(),
            'link' => "/app/admin/subscriptions?focus={$s->id}",
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

    protected function subject(): string
    {
        $s = $this->subscription;
        $days = $s->daysUntilExpiry();

        return match ($this->type) {
            'subscription_expired' => "EXPIRED: {$s->displayName()}",
            'subscription_expires_today' => "Expires TODAY: {$s->displayName()}",
            default => "Expires in {$days} ".str('day')->plural($days).": {$s->displayName()}",
        };
    }

    protected function buildMessage(): string
    {
        $s = $this->subscription;
        $name = $s->displayName();
        $for = ($client = $this->clientLabel()) ? " for {$client}" : '';
        $days = $s->daysUntilExpiry();

        return match ($this->type) {
            'subscription_expired' => "{$name}{$for} EXPIRED ".abs($days).' '.str('day')->plural(abs($days)).' ago — renew it now',
            'subscription_expires_today' => "{$name}{$for} expires TODAY",
            default => "{$name}{$for} expires in {$days} ".str('day')->plural($days).' ('.$s->expires_on->format('M j, Y').')',
        };
    }

    protected function clientLabel(): ?string
    {
        $client = $this->subscription->client ?? $this->subscription->clientSystem?->client;
        $name = $client?->store_name ?: $client?->name;
        $system = $this->subscription->clientSystem?->displayName();

        return $name ? ($system ? "{$name} — {$system}" : $name) : null;
    }

    protected function appLink(): string
    {
        return rtrim((string) config('app.url'), '/')."/app/admin/subscriptions?focus={$this->subscription->id}";
    }
}
