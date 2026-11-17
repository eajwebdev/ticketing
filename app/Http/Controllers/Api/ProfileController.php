<?php

namespace App\Http\Controllers\Api;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicProfileResource;
use App\Http\Resources\UserResource;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'bio' => ['nullable', 'string'],
            'position' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:255'],
            'store_name' => ['nullable', 'string', 'max:255'],
            'business_types' => ['nullable', 'array', 'max:20'],
            'business_types.*' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'avatar' => ['nullable', 'image', 'max:4096'],
        ]);

        if ($request->hasFile('avatar')) {
            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }
            $data['avatar_path'] = $request->file('avatar')->store('avatars', 'public');
        }
        unset($data['avatar']);

        $user->update($data);

        return new UserResource($user->fresh());
    }

    public function show(User $user)
    {
        abort_unless($user->isTeam(), 404);

        $resolvedCount = Ticket::where('resolved_by', $user->id)->count();

        $avgResolution = Ticket::where('resolved_by', $user->id)
            ->whereNotNull('resolved_at')
            ->get()
            ->avg(fn ($t) => $t->resolution_time_minutes);

        $user->stats = [
            'tickets_resolved' => $resolvedCount,
            'avg_resolution_minutes' => $avgResolution ? round($avgResolution) : null,
        ];

        return new PublicProfileResource($user);
    }

    public function team()
    {
        $team = User::team()
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->each(function ($user) {
                $user->stats = [
                    'tickets_resolved' => Ticket::where('resolved_by', $user->id)->count(),
                ];
            });

        return PublicProfileResource::collection($team);
    }
}
