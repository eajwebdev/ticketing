<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT_ID = 'test-client.apps.googleusercontent.com';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.google.client_id' => self::CLIENT_ID]);
    }

    private array $google = [];

    private int $googleStatus = 200;

    private bool $faked = false;

    /** What Google's tokeninfo endpoint answers for the next requests. */
    private function fakeGoogle(array $overrides = [], int $status = 200): void
    {
        $this->google = [
            'iss' => 'https://accounts.google.com',
            'aud' => self::CLIENT_ID,
            'sub' => 'google-sub-123',
            'email' => 'Owner@Store.com',
            'email_verified' => 'true',
            'name' => 'Store Owner',
            'exp' => (string) (time() + 3600),
            ...$overrides,
        ];
        $this->googleStatus = $status;

        if (! $this->faked) {
            $this->faked = true;
            Http::fake(['oauth2.googleapis.com/*' => fn () => Http::response($this->google, $this->googleStatus)]);
        }
    }

    public function test_unknown_google_user_becomes_pending_client_without_token(): void
    {
        $this->fakeGoogle();

        $this->postJson('/api/v1/auth/google', ['credential' => 'id-token'])
            ->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonMissingPath('token');

        $user = User::where('email', 'owner@store.com')->firstOrFail();
        $this->assertSame(Role::Customer, $user->role);
        $this->assertSame('pending', $user->approval_status);
        $this->assertSame('google-sub-123', $user->google_id);

        // Signing in again while pending is still blocked.
        $this->postJson('/api/v1/auth/google', ['credential' => 'id-token'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.credential.0', 'Your account is still awaiting admin approval.');
    }

    public function test_existing_approved_account_signs_in_and_gets_linked(): void
    {
        $user = User::factory()->create([
            'email' => 'owner@store.com', 'role' => Role::Admin, 'approval_status' => 'approved',
        ]);
        $this->fakeGoogle();

        $this->postJson('/api/v1/auth/google', ['credential' => 'id-token'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user'])
            ->assertJsonPath('user.email', 'owner@store.com');

        $this->assertSame('google-sub-123', $user->fresh()->google_id);
    }

    public function test_deactivated_account_is_blocked(): void
    {
        User::factory()->create(['email' => 'owner@store.com', 'role' => Role::Admin, 'is_active' => false]);
        $this->fakeGoogle();

        $this->postJson('/api/v1/auth/google', ['credential' => 'id-token'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('credential');
    }

    public function test_email_linked_to_another_google_account_is_rejected(): void
    {
        User::factory()->create([
            'email' => 'owner@store.com', 'google_id' => 'someone-else', 'approval_status' => 'approved',
        ]);
        $this->fakeGoogle();

        $this->postJson('/api/v1/auth/google', ['credential' => 'id-token'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('credential');
    }

    public function test_tokens_for_another_app_or_unverified_email_are_rejected(): void
    {
        foreach ([['aud' => 'other-app'], ['email_verified' => 'false'], ['exp' => '1']] as $bad) {
            $this->fakeGoogle($bad);
            $this->postJson('/api/v1/auth/google', ['credential' => 'id-token'])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('credential');
        }

        $this->fakeGoogle([], 400);
        $this->postJson('/api/v1/auth/google', ['credential' => 'bad'])->assertUnprocessable();

        $this->assertDatabaseCount('users', 0);
    }

    public function test_disabled_when_client_id_not_configured(): void
    {
        config(['services.google.client_id' => null]);
        Http::fake();

        $this->postJson('/api/v1/auth/google', ['credential' => 'id-token'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.credential.0', 'Google sign-in is not enabled.');
        Http::assertNothingSent();
    }
}
