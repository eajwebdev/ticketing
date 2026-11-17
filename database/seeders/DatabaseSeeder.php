<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Category;
use App\Models\SystemType;
use App\Models\UrgencyLevel;
use App\Models\User;
use App\Support\DefaultSystems;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Production seeder — creates only what a fresh install needs:
     *  - one admin account (credentials configurable via env)
     *  - the default EAJ systems
     *  - baseline categories & urgency levels
     * No demo clients, agents, or tickets.
     */
    public function run(): void
    {
        // ---- Default systems ----
        foreach (DefaultSystems::all() as $i => $s) {
            SystemType::firstOrCreate(['name' => $s['name']], [...$s, 'is_active' => true, 'sort_order' => $i + 1]);
        }

        // ---- Baseline categories ----
        $categories = [
            ['name' => 'Bug', 'description' => 'Something is broken'],
            ['name' => 'Inquiry', 'description' => 'General question'],
            ['name' => 'Feature Request', 'description' => 'New capability request'],
            ['name' => 'Billing', 'description' => 'Payments & subscriptions'],
            ['name' => 'Onboarding', 'description' => 'Setup & training'],
        ];
        foreach ($categories as $i => $c) {
            Category::firstOrCreate(['name' => $c['name']], [...$c, 'is_active' => true, 'sort_order' => $i + 1]);
        }

        // ---- Urgency levels (with SLA targets) ----
        $urgencies = [
            ['name' => 'Low', 'color' => '#8A96B8', 'sla_hours' => 72],
            ['name' => 'Medium', 'color' => '#3B82F6', 'sla_hours' => 48],
            ['name' => 'High', 'color' => '#F59E0B', 'sla_hours' => 24],
            ['name' => 'Critical', 'color' => '#E91E4F', 'sla_hours' => 4],
        ];
        foreach ($urgencies as $i => $u) {
            UrgencyLevel::firstOrCreate(['name' => $u['name']], [...$u, 'is_active' => true, 'sort_order' => $i + 1]);
        }

        // ---- Default admin (change the password after first login!) ----
        // Read via config() so this works even after `php artisan config:cache`.
        $email = config('seeding.admin.email') ?: 'abriljredwin@gmail.com';
        $password = config('seeding.admin.password') ?: 'EdzkiE@2026';

        User::firstOrCreate(
            ['email' => $email],
            [
                'name' => config('seeding.admin.name') ?: 'EAJ Admin',
                'password' => $password,
                'role' => Role::Admin,
                'position' => 'Lead Developer',
                'department' => 'Development',
                'is_active' => true,
                'approval_status' => 'approved',
                'approved_at' => now(), 
            ]
        );

        $this->command?->info('Seeded default systems, categories, urgency levels.');
        $this->command?->warn("Admin account: {$email} (password from SEED_ADMIN_PASSWORD or the seeder default — change it after first login!)");
    }
}
