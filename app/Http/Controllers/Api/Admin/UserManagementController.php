<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->latest();

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%$s%")->orWhere('email', 'like', "%$s%"));
        }

        return UserResource::collection($query->paginate(20)->withQueryString());
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'role' => ['sometimes', Rule::in(['customer', 'agent', 'admin'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // Prevent an admin from demoting/deactivating themselves.
        if ($user->id === $request->user()->id) {
            unset($data['role'], $data['is_active']);
        }

        $user->update($data);

        return new UserResource($user->fresh());
    }
}
