<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreClientRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $query = User::where('role', Role::Customer)->latest();

        if ($request->filled('status')) {
            $query->where('approval_status', $request->status);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('email', 'like', "%$s%")
                ->orWhere('store_name', 'like', "%$s%")
                // JSON columns compare case-sensitively in MySQL — cast to text first.
                ->orWhereRaw('LOWER(CAST(business_types AS CHAR)) LIKE ?', ['%'.mb_strtolower($s).'%']));
        }

        $perPage = min($request->integer('per_page', 15), 200);

        return UserResource::collection($query->paginate($perPage)->withQueryString());
    }

    public function store(StoreClientRequest $request)
    {
        $tempPassword = Str::password(12);
        $data = $request->validated();

        if ($request->hasFile('avatar')) {
            $data['avatar_path'] = $request->file('avatar')->store('avatars', 'public');
        }
        unset($data['avatar']);

        $user = User::create([
            ...$data,
            'role' => Role::Customer,
            'password' => $tempPassword,
            // Admin-created clients are approved immediately.
            'approval_status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return response()->json([
            'user' => new UserResource($user),
            'temporary_password' => $tempPassword,
        ], 201);
    }

    public function update(StoreClientRequest $request, User $user)
    {
        abort_unless($user->role === Role::Customer, 404);

        $data = $request->validated();
        if ($request->hasFile('avatar')) {
            $data['avatar_path'] = $request->file('avatar')->store('avatars', 'public');
        }
        unset($data['avatar']);

        $user->update($data);

        return new UserResource($user->fresh());
    }

    public function approve(Request $request, User $user)
    {
        abort_unless($user->role === Role::Customer, 404);

        $user->update([
            'approval_status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return new UserResource($user->fresh());
    }

    public function reject(Request $request, User $user)
    {
        abort_unless($user->role === Role::Customer, 404);

        $user->update([
            'approval_status' => 'rejected',
            'approved_by' => $request->user()->id,
            'approved_at' => null,
        ]);

        return new UserResource($user->fresh());
    }
}
