<?php

namespace App\Console\Commands;

use App\Support\Permissions;
use App\Models\ClientSystem;
use App\Models\User;
use App\Notifications\BillingNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class SendBillingReminders extends Command
{
    protected $signature = 'billing:remind';

    protected $description = 'Notify billing staff about client systems due in 7 or 3 days, due today, or overdue (daily).';

    public function handle(): int
    {
        // Everyone who handles billing (owner/admin, finance, or anyone granted it).
        $admins = User::team()->where('is_active', true)->get()->filter(fn ($u) => $u->hasPermission(Permissions::BILLING));
        if ($admins->isEmpty()) {
            $this->warn('No active admins to notify.');

            return self::SUCCESS;
        }

        $today = today();
        $sent = 0;

        $candidates = ClientSystem::with(['client', 'systemType'])->active()
            ->whereDate('next_due_date', '<=', $today->copy()->addDays(max(ClientSystem::REMIND_DAYS_BEFORE)))
            ->where(fn ($q) => $q->whereNull('last_reminded_on')->orWhereDate('last_reminded_on', '<', $today))
            ->get();

        foreach ($candidates as $system) {
            $days = $system->daysUntilDue();

            $type = match (true) {
                $days < 0 => 'billing_overdue',                                   // every day until paid
                $days === 0 => 'billing_due_today',
                in_array($days, ClientSystem::REMIND_DAYS_BEFORE, true) => 'billing_due',
                default => null,
            };
            if (! $type) {
                continue;
            }

            foreach ($admins as $admin) {
                try {
                    $admin->notify(new BillingNotification($type, $system));
                } catch (\Throwable $e) {
                    // The in-app notification is saved before broadcasting, so a Reverb
                    // outage only costs the live toast — don't let it stop the run.
                    Log::warning('Billing reminder broadcast failed', ['error' => $e->getMessage()]);
                }
            }

            $system->forceFill(['last_reminded_on' => $today])->saveQuietly();
            $sent++;
            $this->line("• {$system->displayName()} for {$system->client?->name}: {$type}");
        }

        $this->info("Billing reminders sent for {$sent} system(s).");

        return self::SUCCESS;
    }
}
