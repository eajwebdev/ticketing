<?php

/*
 * Values used by DatabaseSeeder. Read through config() (not env()) so seeding
 * still works on servers where `php artisan config:cache` has been run —
 * once config is cached, env() returns null outside config files.
 */
return [
    'admin' => [
        'name' => env('SEED_ADMIN_NAME', 'EAJ Admin'),
        'email' => env('SEED_ADMIN_EMAIL', 'abriljredwin@gmail.com'),
        'password' => env('SEED_ADMIN_PASSWORD'),
    ],
];
