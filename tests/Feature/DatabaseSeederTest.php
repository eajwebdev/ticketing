<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Category;
use App\Models\SystemType;
use App\Models\UrgencyLevel;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    private function seedWith(array $admin): void
    {
        config(['seeding.admin' => array_merge([
            'name' => 'EAJ Admin',
            'email' => 'owner@example.com',
            'password' => 'Secret-Pass-123',
            'reset_password' => false,
        ], $admin)]);

        $this->seed(DatabaseSeeder::class);
    }

    public function test_creates_admin_from_env_values_and_lookups(): void
    {
        $this->seedWith(['email' => '  Owner@Example.com ']);

        $admin = User::where('email', 'owner@example.com')->firstOrFail();
        $this->assertSame(Role::Admin, $admin->role);
        $this->assertTrue($admin->is_active);
        $this->assertSame('approved', $admin->approval_status);
        $this->assertTrue(Hash::check('Secret-Pass-123', $admin->password));

        $this->assertGreaterThan(0, SystemType::count());
        $this->assertSame(5, Category::count());
        $this->assertSame(4, UrgencyLevel::count());
    }

    public function test_empty_env_values_still_seed_with_generated_password(): void
    {
        $this->seedWith(['name' => '', 'email' => '', 'password' => '']);

        $admin = User::where('role', Role::Admin->value)->sole();
        $this->assertSame('EAJ Admin', $admin->name);
        $this->assertFalse(Hash::check('EdzkiE@2026', $admin->password));
    }

    public function test_reseeding_is_idempotent_and_keeps_password_by_default(): void
    {
        $this->seedWith([]);
        User::where('email', 'owner@example.com')->update(['is_active' => false]);

        $this->seedWith(['password' => 'Another-Pass-456']);

        $this->assertSame(1, User::where('email', 'owner@example.com')->count());
        $this->assertSame(5, Category::count());
        $admin = User::where('email', 'owner@example.com')->first();
        $this->assertTrue($admin->is_active);
        $this->assertTrue(Hash::check('Secret-Pass-123', $admin->password));
    }

    public function test_reset_flag_updates_existing_admin_password(): void
    {
        $this->seedWith([]);
        $this->seedWith(['password' => 'Another-Pass-456', 'reset_password' => true]);

        $admin = User::where('email', 'owner@example.com')->first();
        $this->assertTrue(Hash::check('Another-Pass-456', $admin->password));
    }

    public function test_invalid_email_fails_loudly(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->seedWith(['email' => 'not-an-email']);
    }
}
