<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Category;
use App\Models\SystemType;
use App\Models\UrgencyLevel;
use App\Models\User;
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
        $systems = [
            ['name' => 'Laundry Management System', 'description' => 'POS & operations for laundry shops', 'icon' => 'WashingMachine'],
            ['name' => 'Pharmacy Management System', 'description' => 'Dispensing, stock & sales for pharmacies', 'icon' => 'Pill'],
            ['name' => 'Human Resource Management System', 'description' => 'Employee records, payroll & attendance', 'icon' => 'Users'],
            ['name' => 'Restaurant POS', 'description' => 'Orders, inventory & operations for restaurants', 'icon' => 'UtensilsCrossed'],
            ['name' => 'Water Refilling Management System', 'description' => null, 'icon' => 'Droplets'],
            ['name' => 'Cafe POS', 'description' => null, 'icon' => 'Coffee'],
        ];
        foreach ($systems as $i => $s) {
            SystemType::create([...$s, 'is_active' => true, 'sort_order' => $i + 1]);
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
            Category::create([...$c, 'is_active' => true, 'sort_order' => $i + 1]);
        }

        // ---- Urgency levels (with SLA targets) ----
        $urgencies = [
            ['name' => 'Low', 'color' => '#8A96B8', 'sla_hours' => 72],
            ['name' => 'Medium', 'color' => '#3B82F6', 'sla_hours' => 48],
            ['name' => 'High', 'color' => '#F59E0B', 'sla_hours' => 24],
            ['name' => 'Critical', 'color' => '#E91E4F', 'sla_hours' => 4],
        ];
        foreach ($urgencies as $i => $u) {
            UrgencyLevel::create([...$u, 'is_active' => true, 'sort_order' => $i + 1]);
        }

        // ---- Default admin (change the password after first login!) ----
        $email = env('SEED_ADMIN_EMAIL', 'abriljredwin@gmail.com');
        $password = env('SEED_ADMIN_PASSWORD', 'EdzkiE@2026');

        User::firstOrCreate(
            ['email' => $email],
            [
                'name' => env('SEED_ADMIN_NAME', 'EAJ Admin'),
                'password' => $password,
                'role' => Role::Admin,
                'position' => 'Lead Developer',
                'department' => 'Development',
                'is_active' => true,
                'approval_status' => 'approved',
                'approved_at' => now(), 
            ]
        );

        $this->command->info("Seeded default systems, categories, urgency levels.");
        $this->command->warn("Admin account: {$email}  (password from SEED_ADMIN_PASSWORD, default \"password\" — change it!)");
    }
}
