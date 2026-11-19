<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\SubscriptionExpiryNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendSubscriptionReminders extends Command
{
    protected $signature = 'subscriptions:remind';

    protected $description = 'Email the Owner/Admin users about domains, hosting and VPS that are about to expire or have expired.';

    public function handle(): int
    {
        $recipients = self::recipients();
        if ($recipients->isEmpty()) {
            $this->warn('No active Owner/Admin users to notify.');

            return self::SUCCESS;
        }

        $stages = collect(config('subscriptions.alert_days', [30, 14, 7, 3, 1]))->map(fn ($d) => (int) $d)->sortDesc()->values();
        $today = today();
        $sent = 0;

        $candidates = Subscription::with(['client', 'clientSystem.client', 'clientSystem.systemType'])->active()
            ->whereDate('expires_on', '<=', $today->copy()->addDays($stages->max() ?? 30))
            ->where(fn ($q) => $q->whereNull('last_alerted_on')->orWhereDate('last_alerted_on', '<', $today))
            ->orderBy('expires_on')
            ->get();

        foreach ($candidates as $sub) {
            $days = $sub->daysUntilExpiry();

            if ($days <= 0) {
                // On the day and every day after, until renewed or cancelled.
                $stage = 0;
                $type = $days === 0 ? 'subscription_expires_today' : 'subscription_expired';
            } else {
                // The tightest stage we're inside of (e.g. 5 days left → the 7-day stage).
                // Comparing stages instead of exact days means a missed day (server off)
                // is caught up next run instead of silently skipped.
                $stage = $stages->filter(fn ($d) => $days <= $d)->min();
                if ($stage === null || ($sub->last_alert_stage !== null && $sub->last_alert_stage <= $stage)) {
                    continue;
                }
                $type = 'subscription_expiring';
            }

            $notification = new SubscriptionExpiryNotification($type, $sub);
            foreach ($recipients as $user) {
                try {
                    $user->notify($notification);
                } catch (\Throwable $e) {
                    // The in-app copy is saved first, so a mail or Reverb outage only costs
                    // the email/toast for this person — keep going for everyone else.
                    Log::warning('Subscription reminder delivery failed', ['user' => $user->id, 'error' => $e->getMessage()]);
                    $this->warn("  could not reach {$user->email}: {$e->getMessage()}");
                }
            }

            $sub->forceFill(['last_alert_stage' => $stage, 'last_alerted_on' => $today])->saveQuietly();
            $sent++;
            $this->line("• {$sub->displayName()}: {$type} ({$days}d)");
        }

        $this->info("Subscription reminders sent for {$sent} item(s).");

        return self::SUCCESS;
    }

    /** Every active user with the Owner/Admin role — their users.email gets the alert. */
    public static function recipients()
    {
        return User::where('role', Role::Admin->value)
            ->where('is_active', true)
            ->whereNotNull('email')
            ->get();
    }
}
