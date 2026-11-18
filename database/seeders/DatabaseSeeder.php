<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Category;
use App\Models\SystemType;
use App\Models\UrgencyLevel;
use App\Models\User;
use App\Support\DefaultSystems;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

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

        $this->command?->info('Seeded default systems, categories, urgency levels.');

        $this->seedAdmin();
    }

    /**
     * Create (or repair) the admin account from SEED_ADMIN_* in .env.
     * Read via config() so this works even after `php artisan config:cache`.
     * Safe to run repeatedly — it never creates a second admin.
     */
    private function seedAdmin(): void
    {
        $name = trim((string) config('seeding.admin.name')) ?: 'EAJ Admin';
        $email = mb_strtolower(trim((string) config('seeding.admin.email'))) ?: 'abriljredwin@gmail.com';
        $password = (string) config('seeding.admin.password');

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \RuntimeException("SEED_ADMIN_EMAIL is not a valid email address: \"{$email}\"");
        }

        $generated = false;
        if ($password === '') {
            $password = Str::password(20, symbols: false);
            $generated = true;
        }

        $admin = User::where('email', $email)->first();

        if (! $admin) {
            User::forceCreate([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'role' => Role::Admin,
                'position' => 'Lead Developer',
                'department' => 'Development',
                'is_active' => true,
                'approval_status' => 'approved',
                'approved_at' => now(),
                'email_verified_at' => now(),
            ]);

            $this->command?->info("Admin account created: {$email}");
            $this->reportPassword($password, $generated);

            return;
        }

        // Existing account: make sure it can actually sign in as admin.
        $admin->forceFill([
            'role' => Role::Admin,
            'is_active' => true,
            'approval_status' => 'approved',
            'approved_at' => $admin->approved_at ?? now(),
        ]);

        $reset = config('seeding.admin.reset_password') && ! $generated;
        if ($reset) {
            $admin->password = $password;
        }
        $admin->save();

        $this->command?->info("Admin account already exists: {$email} (ensured active admin)");
        $this->command?->line($reset
            ? '  Password reset to SEED_ADMIN_PASSWORD.'
            : '  Password left unchanged (set SEED_ADMIN_RESET_PASSWORD=true to reset it from .env).');
    }

    private function reportPassword(string $password, bool $generated): void
    {
        if ($generated) {
            $this->command?->warn('SEED_ADMIN_PASSWORD was empty — generated password (shown ONCE, save it now):');
            $this->command?->line("  {$password}");
        } else {
            $this->command?->line('  Password: the value of SEED_ADMIN_PASSWORD.');
        }
        $this->command?->warn('  Change it after first login.');
    }
}
