<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientBusinessTypesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        config(['broadcasting.default' => 'null']);
        $this->admin = User::factory()->create(['role' => Role::Admin, 'approval_status' => 'approved']);
        Sanctum::actingAs($this->admin);
    }

    public function test_client_can_have_multiple_business_types(): void
    {
        $res = $this->postJson('/api/v1/admin/clients', [
            'name' => 'Ana Cruz',
            'email' => 'ana@shop.test',
            'store_name' => 'Cruz Enterprises',
            // trimmed, de-duplicated case-insensitively, blanks dropped
            'business_types' => ['Laundry Shop', ' Water Refilling Station ', 'laundry shop', ''],
        ])->assertCreated();

        $res->assertJsonPath('user.business_types', ['Laundry Shop', 'Water Refilling Station']);

        $client = User::where('email', 'ana@shop.test')->first();
        $this->assertSame(['Laundry Shop', 'Water Refilling Station'], $client->business_types);

        // Update replaces the list; searching by a type finds the client.
        $this->patchJson("/api/v1/admin/clients/{$client->id}", [
            'name' => 'Ana Cruz', 'email' => 'ana@shop.test', 'store_name' => 'Cruz Enterprises',
            'business_types' => ['Pharmacy', 'Cafe'],
        ])->assertOk()->assertJsonPath('data.business_types', ['Pharmacy', 'Cafe']);

        $this->getJson('/api/v1/admin/clients?search=pharmacy')->assertOk()->assertJsonCount(1, 'data');

        // Clearing the list stores null and returns [].
        $this->patchJson("/api/v1/admin/clients/{$client->id}", [
            'name' => 'Ana Cruz', 'email' => 'ana@shop.test', 'store_name' => 'Cruz Enterprises',
            'business_types' => [],
        ])->assertOk()->assertJsonPath('data.business_types', []);
        $this->assertDatabaseHas('users', ['id' => $client->id, 'business_types' => null]);
    }

    public function test_business_types_must_be_a_list_of_short_strings(): void
    {
        $this->postJson('/api/v1/admin/clients', [
            'name' => 'X', 'email' => 'x@shop.test', 'store_name' => 'X',
            'business_types' => [str_repeat('a', 101)],
        ])->assertUnprocessable()->assertJsonValidationErrors('business_types.0');

        $this->postJson('/api/v1/admin/clients', [
            'name' => 'X', 'email' => 'x@shop.test', 'store_name' => 'X',
            'business_types' => 'Laundry Shop',
        ])->assertUnprocessable()->assertJsonValidationErrors('business_types');
    }

    public function test_client_updates_own_business_types_from_profile(): void
    {
        $client = User::factory()->create(['role' => Role::Customer, 'approval_status' => 'approved']);
        Sanctum::actingAs($client);

        $this->patchJson('/api/v1/me', ['business_types' => ['Restaurant', 'Cafe']])
            ->assertOk()->assertJsonPath('data.business_types', ['Restaurant', 'Cafe']);
    }
}
