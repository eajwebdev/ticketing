<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    /** Roles + permission catalog, so the UI never hard-codes them. */
    public function roles()
    {
        return [
            'roles' => collect(Role::cases())->map(fn (Role $r) => [
                'value' => $r->value,
                'label' => $r->label(),
                'is_team' => $r->isTeam(),
                'default_permissions' => $r->defaultPermissions(),
            ])->values(),
            'permissions' => collect(Permissions::LABELS)->map(fn ($l, $key) => [
                'key' => $key, 'label' => $l[0], 'description' => $l[1],
            ])->values(),
        ];
    }

    public function index(Request $request)
    {
        $query = User::query()->latest();

        match ($request->input('role')) {
            null, '', 'all' => null,
            'team' => $query->team(),
            default => $query->where('role', $request->input('role')),
        };
        if ($request->filled('status')) {
            $query->where('is_active', $request->input('status') === 'active');
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%$s%")
                ->orWhere('email', 'like', "%$s%")
                ->orWhere('store_name', 'like', "%$s%")
                ->orWhere('position', 'like', "%$s%"));
        }

        $counts = User::selectRaw('role, COUNT(*) as c')->groupBy('role')->pluck('c', 'role');

        return UserResource::collection($query->paginate(min($request->integer('per_page', 20), 100))->withQueryString())
            ->additional(['counts' => $counts]);
    }

    /** Create an account of any role. Returns a one-time temporary password. */
    public function store(Request $request)
    {
        $data = $this->validated($request);
        $tempPassword = Str::password(12);

        $user = User::create([
            ...$data,
            'password' => $tempPassword,
            'is_active' => true,
            'approval_status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return response()->json([
            'user' => new UserResource($user),
            'temporary_password' => $tempPassword,
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $this->validated($request, $user);

        // You can't lock yourself out: no changing your own role, status or permissions.
        if ($user->id === $request->user()->id) {
            unset($data['role'], $data['is_active'], $data['permissions']);
        }

        // Last active owner/admin can't be demoted or deactivated.
        if ($user->isAdmin() && ((isset($data['role']) && $data['role'] !== Role::Admin->value) || (isset($data['is_active']) && ! $data['is_active']))) {
            $otherAdmins = User::where('role', Role::Admin)->where('is_active', true)->where('id', '!=', $user->id)->exists();
            abort_unless($otherAdmins, 422, 'At least one active Owner / Admin is required.');
        }

        $user->update($data);
        if (isset($data['is_active']) && ! $data['is_active']) {
            $user->tokens()->delete(); // sign them out everywhere
        }

        return new UserResource($user->fresh());
    }

    public function resetPassword(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'Use your profile page to change your own password.');

        $tempPassword = Str::password(12);
        $user->update(['password' => $tempPassword]);
        $user->tokens()->delete();

        return ['temporary_password' => $tempPassword];
    }

    private function validated(Request $request, ?User $user = null): array
    {
        $creating = ! $user;
        $rule = fn (array $r) => $creating ? ['required', ...$r] : ['sometimes', ...$r];

        $data = $request->validate([
            'name' => $rule(['string', 'max:255']),
            'email' => $rule(['email', 'max:255', Rule::unique('users', 'email')->ignore($user?->id)]),
            'role' => $rule([Rule::enum(Role::class)]),
            'is_active' => ['sometimes', 'boolean'],
            // null/absent = use role defaults; array = custom set
            'permissions' => ['sometimes', 'nullable', 'array'],
            'permissions.*' => [Rule::in(Permissions::ALL)],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'position' => ['sometimes', 'nullable', 'string', 'max:255'],
            'department' => ['sometimes', 'nullable', 'string', 'max:255'],
            'store_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'business_types' => ['sometimes', 'nullable', 'array', 'max:20'],
            'business_types.*' => ['nullable', 'string', 'max:100'],
            'contact_person' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $role = Role::from($data['role'] ?? $user->role->value);
        if (! $role->isTeam() || $role === Role::Admin) {
            $data['permissions'] = null; // clients have none; admins have all
        } elseif (array_key_exists('permissions', $data) && $data['permissions'] !== null) {
            $data['permissions'] = array_values(array_unique($data['permissions']));
            // Saving exactly the defaults = follow the role (so future default changes apply).
            $defaults = $role->defaultPermissions();
            sort($defaults);
            $chosen = $data['permissions'];
            sort($chosen);
            if ($chosen === $defaults) {
                $data['permissions'] = null;
            }
        } elseif (isset($data['role']) && $user && $data['role'] !== $user->role->value) {
            $data['permissions'] = null; // role changed without a custom set → reset to new defaults
        }

        return $data;
    }
}
