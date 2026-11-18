<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientBusinessNamesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['broadcasting.default' => 'null']);
        Sanctum::actingAs(User::factory()->create(['role' => Role::Admin, 'approval_status' => 'approved']));
    }

    public function test_client_can_have_multiple_business_names_first_is_primary(): void
    {
        $this->postJson('/api/v1/admin/clients', [
            'name' => 'Juan Cruz',
            'email' => 'juan@shop.test',
            'business_names' => ['Juan Laundry', ' Cruz, Inc. ', 'Juan Water Station'],
        ])->assertCreated()
            ->assertJsonPath('user.store_name', 'Juan Laundry')
            ->assertJsonPath('user.business_names', ['Juan Laundry', 'Cruz, Inc.', 'Juan Water Station']);

        $client = User::where('email', 'juan@shop.test')->first();

        // Reordering changes the primary name.
        $this->patchJson("/api/v1/admin/clients/{$client->id}", [
            'name' => 'Juan Cruz', 'email' => 'juan@shop.test',
            'business_names' => ['Juan Water Station', 'Juan Laundry'],
        ])->assertOk()->assertJsonPath('data.store_name', 'Juan Water Station');

        // Searching by a secondary name finds the client.
        $this->getJson('/api/v1/admin/clients?search=juan laundry')
            ->assertOk()->assertJsonPath('data.0.id', $client->id);
    }

    public function test_requires_a_name_and_rejects_duplicates(): void
    {
        $base = ['name' => 'X', 'email' => 'x@shop.test'];

        $this->postJson('/api/v1/admin/clients', [...$base, 'business_names' => []])
            ->assertJsonValidationErrors('business_names');

        $this->postJson('/api/v1/admin/clients', [...$base, 'business_names' => ['Shop', 'shop']])
            ->assertJsonValidationErrors('business_names.1');
    }

    public function test_store_name_only_still_works_and_stays_in_sync(): void
    {
        // Older callers (register, profile, users screen) send just store_name.
        $this->postJson('/api/v1/admin/clients', [
            'name' => 'Ana', 'email' => 'ana@shop.test', 'store_name' => 'Ana Bakery',
        ])->assertCreated()->assertJsonPath('user.business_names', ['Ana Bakery']);

        $client = User::where('email', 'ana@shop.test')->first();
        $client->update(['business_names' => ['Ana Bakery', 'Ana Cafe']]);

        // Renaming the primary keeps the other businesses.
        $client->update(['store_name' => 'Ana Bakeshop']);
        $this->assertSame(['Ana Bakeshop', 'Ana Cafe'], $client->fresh()->business_names);
        $this->assertSame('Ana Bakeshop', $client->fresh()->store_name);
    }
}
