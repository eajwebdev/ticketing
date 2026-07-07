<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreTeamMemberRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TeamController extends Controller
{
    public function index(Request $request)
    {
        $query = User::whereIn('role', ['agent', 'admin'])->latest();

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('email', 'like', "%$s%")
                ->orWhere('department', 'like', "%$s%"));
        }

        return UserResource::collection($query->paginate(15)->withQueryString());
    }

    public function store(StoreTeamMemberRequest $request)
    {
        $tempPassword = Str::password(12);
        $data = $request->validated();

        if ($request->hasFile('avatar')) {
            $data['avatar_path'] = $request->file('avatar')->store('avatars', 'public');
        }
        unset($data['avatar']);

        $user = User::create([
            ...$data,
            'password' => $tempPassword,
        ]);

        return response()->json([
            'user' => new UserResource($user),
            'temporary_password' => $tempPassword,
        ], 201);
    }

    public function update(StoreTeamMemberRequest $request, User $user)
    {
        abort_unless($user->isTeam(), 404);

        $data = $request->validated();
        if ($request->hasFile('avatar')) {
            $data['avatar_path'] = $request->file('avatar')->store('avatars', 'public');
        }
        unset($data['avatar']);

        $user->update($data);

        return new UserResource($user->fresh());
    }
}
