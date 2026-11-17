<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request)
    {
        // Self-registered clients must be approved by an admin before they can sign in.
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => $request->password,
            'store_name' => $request->store_name,
            'phone' => $request->phone,
            'role' => Role::Customer,
            'approval_status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Your account has been created and is awaiting admin approval. You will be able to sign in once approved.',
            'status' => 'pending',
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        return $this->issueToken($request, $user);
    }

    /**
     * "Sign in with Google": the browser sends the ID token from Google Identity
     * Services; we verify it with Google, then sign in the matching account.
     * Unknown emails become pending client accounts (same as self-registration).
     */
    public function google(Request $request)
    {
        $request->validate(['credential' => ['required', 'string', 'max:4096']]);

        $clientId = config('services.google.client_id');
        if (! $clientId) {
            throw ValidationException::withMessages(['credential' => ['Google sign-in is not enabled.']]);
        }

        $profile = $this->verifyGoogleToken($request->credential, $clientId);
        if (! $profile) {
            throw ValidationException::withMessages(['credential' => ['Google sign-in failed. Please try again.']]);
        }

        $email = Str::lower($profile['email']);
        $user = User::where('google_id', $profile['sub'])->first()
            ?? User::where('email', $email)->first();

        if (! $user) {
            (new User([
                'name' => $profile['name'] ?? Str::before($email, '@'),
                'email' => $email,
                'password' => Str::random(40), // unusable; they sign in with Google
                'role' => Role::Customer,
                'approval_status' => 'pending',
            ]))->forceFill(['google_id' => $profile['sub'], 'email_verified_at' => now()])->save();

            return response()->json([
                'message' => 'Your account has been created with Google and is awaiting admin approval. You will be able to sign in once approved.',
                'status' => 'pending',
            ], 201);
        }

        // An email already linked to a different Google account — don't hijack it.
        if ($user->google_id && $user->google_id !== $profile['sub']) {
            throw ValidationException::withMessages(['credential' => ['This email is linked to a different Google account.']]);
        }

        if (! $user->google_id) {
            $user->forceFill(['google_id' => $profile['sub'], 'email_verified_at' => $user->email_verified_at ?? now()])->save();
        }

        return $this->issueToken($request, $user, 'credential');
    }

    /** Returns the token's claims when it is a valid Google ID token for our app, else null. */
    private function verifyGoogleToken(string $idToken, string $clientId): ?array
    {
        try {
            $res = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $idToken]);
        } catch (\Throwable) {
            return null;
        }

        $p = $res->ok() ? $res->json() : null;

        $valid = is_array($p)
            && ($p['aud'] ?? null) === $clientId
            && in_array($p['iss'] ?? null, ['accounts.google.com', 'https://accounts.google.com'], true)
            && (int) ($p['exp'] ?? 0) > time()
            && filter_var($p['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && ! empty($p['email']) && ! empty($p['sub']);

        return $valid ? $p : null;
    }

    /** Shared by password and Google sign-in: account checks, then a Sanctum token. */
    private function issueToken(Request $request, User $user, string $field = 'email')
    {
        if (! $user->is_active) {
            throw ValidationException::withMessages([
                $field => ['This account has been deactivated.'],
            ]);
        }

        // Block clients that haven't been approved yet.
        if ($user->isCustomer() && ! $user->isApproved()) {
            throw ValidationException::withMessages([
                $field => [$user->approval_status === 'rejected'
                    ? 'Your account registration was not approved. Please contact EAJ support.'
                    : 'Your account is still awaiting admin approval.'],
            ]);
        }

        $token = $user->createToken('spa')->plainTextToken;
        // So the resource can include the user's own permissions in this response.
        $request->setUserResolver(fn () => $user);

        return response()->json([
            'user' => new UserResource($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        return new UserResource($request->user());
    }
}
