<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Billing: 7 & 3 days before, on the day, and daily while overdue.
// Runs hourly but each system is reminded at most once a day, so a PC that
// was off at 8am still catches up the moment the scheduler is running.
Schedule::command('billing:remind')->hourly()->between('7:00', '21:00')->withoutOverlapping();

// Tasks due/overdue → assignee; lead follow-ups → owner. Once a day each.
Schedule::command('work:remind')->hourly()->between('7:00', '21:00')->withoutOverlapping();

// Domains / hosting / VPS: email Owner/Admin users 30, 14, 7, 3 and 1 day(s)
// before expiry, on the day, and daily once expired. Once a day per item at most.
Schedule::command('subscriptions:remind')->hourly()->between('7:00', '21:00')->withoutOverlapping();
