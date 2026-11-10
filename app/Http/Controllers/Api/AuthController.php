<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['This account has been deactivated.'],
            ]);
        }

        // Block clients that haven't been approved yet.
        if ($user->isCustomer() && ! $user->isApproved()) {
            throw ValidationException::withMessages([
                'email' => [$user->approval_status === 'rejected'
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
