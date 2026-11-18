<?php

namespace App\Models;

use App\Enums\Role;
use App\Support\Permissions;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'store_name',
        'business_names',
        'business_types',
        'address',
        'contact_person',
        'phone',
        'notes',
        'position',
        'department',
        'bio',
        'avatar_path',
        'is_active',
        'permissions',
        'approval_status',
        'approved_by',
        'approved_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = ['avatar_url'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'is_active' => 'boolean',
            'permissions' => 'array',
            'approved_at' => 'datetime',
        ];
    }

    /**
     * A client's kinds of business (e.g. ["Laundry Shop", "Water Refilling"]).
     * Saved trimmed, de-duplicated (case-insensitive) and null when empty.
     */
    protected function businessTypes(): Attribute
    {
        return self::jsonListAttribute();
    }

    /**
     * Every business/store a client owns (e.g. ["Juan Laundry", "Juan Water Station"]).
     * The first one is the primary name and is mirrored into `store_name`.
     */
    protected function businessNames(): Attribute
    {
        return self::jsonListAttribute();
    }

    /** JSON list of strings: trimmed, de-duplicated (case-insensitive), null when empty. */
    private static function jsonListAttribute(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value ? (json_decode($value, true) ?: []) : [],
            set: fn ($value) => ($list = self::normalizeList($value))
                ? json_encode($list, JSON_UNESCAPED_UNICODE) : null,
        );
    }

    private static function normalizeList($value): array
    {
        $list = [];
        foreach ((array) $value as $item) {
            $item = trim((string) $item);
            if ($item !== '' && ! in_array(mb_strtolower($item), array_map('mb_strtolower', $list), true)) {
                $list[] = $item;
            }
        }

        return $list;
    }

    /**
     * Keep `store_name` (primary, shown everywhere) and `business_names` (full list)
     * in sync whichever one a form changed.
     */
    protected static function booted(): void
    {
        static::saving(function (User $user) {
            if ($user->isDirty('business_names')) {
                $user->store_name = $user->business_names[0] ?? null;

                return;
            }

            if ($user->isDirty('store_name')) {
                $old = mb_strtolower(trim((string) $user->getOriginal('store_name')));
                $names = array_values(array_filter(
                    $user->business_names,
                    fn ($n) => mb_strtolower($n) !== $old
                ));
                $new = trim((string) $user->store_name);
                $user->business_names = $new !== '' ? [$new, ...$names] : $names;
                $user->store_name = $user->business_names[0] ?? null;
            }
        });
    }

    public function isApproved(): bool
    {
        return $this->approval_status === 'approved';
    }

    public function isPendingApproval(): bool
    {
        return $this->approval_status === 'pending';
    }

    public function getAvatarUrlAttribute(): ?string
    {
        return $this->avatar_path ? Storage::url($this->avatar_path) : null;
    }

    public function isTeam(): bool
    {
        return $this->role->isTeam();
    }

    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    public function isCustomer(): bool
    {
        return $this->role === Role::Customer;
    }

    /**
     * Effective permissions: the admin-chosen set if one was saved, else the role's defaults.
     * Admins always have everything; clients never have any.
     *
     * @return array<string>
     */
    public function permissionList(): array
    {
        if (! $this->role->isTeam()) {
            return [];
        }
        if ($this->isAdmin()) {
            return Permissions::ALL;
        }

        return array_values(array_intersect(Permissions::ALL, $this->permissions ?? $this->role->defaultPermissions()));
    }

    public function hasPermission(string ...$any): bool
    {
        return (bool) array_intersect($any, $this->permissionList());
    }

    public function canViewCredentials(): bool
    {
        return $this->hasPermission(Permissions::CREDENTIALS);
    }

    /** Who can open the Client Systems list at all. */
    public function canAccessClientSystems(): bool
    {
        return $this->hasPermission(Permissions::SYSTEMS_VIEW, Permissions::CREDENTIALS, Permissions::BILLING);
    }

    public function scopeTeam($query)
    {
        return $query->whereIn('role', Role::teamValues());
    }

    public function clientSystems(): HasMany
    {
        return $this->hasMany(ClientSystem::class, 'client_id');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'customer_id');
    }

    public function assignedTickets()
    {
        return $this->belongsToMany(Ticket::class, 'ticket_assignees')
            ->withPivot('is_primary', 'added_by')
            ->withTimestamps();
    }
}
