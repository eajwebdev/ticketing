<?php

/*
 * Values used by DatabaseSeeder. Read through config() (not env()) so seeding
 * still works on servers where `php artisan config:cache` has been run —
 * once config is cached, env() returns null outside config files.
 * (After editing .env on a server, run `php artisan config:clear` or
 * `php artisan optimize` again so the new values are picked up.)
 */
return [
    'admin' => [
        'name' => env('SEED_ADMIN_NAME', 'EAJ Admin'),
        'email' => env('SEED_ADMIN_EMAIL', 'abriljredwin@gmail.com'),
        // Empty => the seeder generates a strong password and prints it once.
        'password' => env('SEED_ADMIN_PASSWORD'),
        // true => re-running the seeder resets an EXISTING admin's password
        // to SEED_ADMIN_PASSWORD. Leave false so a re-seed never undoes a
        // password changed after first login.
        'reset_password' => (bool) env('SEED_ADMIN_RESET_PASSWORD', false),
    ],
];
