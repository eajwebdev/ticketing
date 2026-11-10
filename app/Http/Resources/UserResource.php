<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'avatar_url' => $this->avatar_url,
            'position' => $this->position,
            'department' => $this->department,
            'bio' => $this->bio,
            'phone' => $this->phone,
            'store_name' => $this->store_name,
            'business_type' => $this->business_type,
            'address' => $this->address,
            'contact_person' => $this->contact_person,
            'notes' => $this->when($request->user()?->isTeam(), $this->notes),
            'is_active' => $this->is_active,
            'role_label' => $this->role->label(),
            // Effective permissions — only revealed to the user themself or to settings managers.
            'permissions' => $this->when(
                $this->isTeam() && ($request->user()?->id === $this->id || $request->user()?->hasPermission(\App\Support\Permissions::SETTINGS)),
                fn () => $this->permissionList()
            ),
            'has_custom_permissions' => $this->when($request->user()?->hasPermission(\App\Support\Permissions::SETTINGS) ?? false, fn () => $this->permissions !== null),
            'approval_status' => $this->approval_status,
            'is_primary' => $this->whenPivotLoaded('ticket_assignees', fn () => (bool) $this->pivot->is_primary),
            'created_at' => $this->created_at,
        ];
    }
}
