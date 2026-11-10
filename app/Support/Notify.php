<?php

namespace App\Support;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

final class Notify
{
    /**
     * Send without letting a Reverb outage break the request. The database copy is
     * written before broadcasting, so the bell still shows it.
     */
    public static function safely($users, Notification $notification): void
    {
        foreach (collect($users)->filter() as $user) {
            try {
                $user->notify($notification);
            } catch (\Throwable $e) {
                Log::warning('Notification broadcast failed', ['error' => $e->getMessage()]);
            }
        }
    }
}
