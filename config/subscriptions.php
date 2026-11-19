<?php

/*
 * Company subscriptions (domains, hosting, VPS…) — expiry alerts.
 * Read through config() so it still works after `php artisan config:cache`.
 */
return [
    // Days before expiry that Owner/Admin users are emailed. They are also
    // alerted on the expiry day and every day after until it is renewed or cancelled.
    // Sent to the users.email of every active user with the Owner/Admin role.
    'alert_days' => [30, 14, 7, 3, 1],
];
