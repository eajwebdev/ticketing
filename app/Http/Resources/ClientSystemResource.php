<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Never includes the credentials themselves — those come from a separate, permission-checked endpoint. */
class ClientSystemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isAdmin = $request->user()?->hasPermission(\App\Support\Permissions::BILLING);

        return [
            'id' => $this->id,
            'system_name' => $this->system_name,
            'label' => $this->label,
            'display_name' => $this->displayName(),
            'client' => $this->whenLoaded('client', fn () => [
                'id' => $this->client->id,
                'name' => $this->client->name,
                'store_name' => $this->client->store_name,
                'email' => $this->client->email,
                'phone' => $this->client->phone,
                'avatar_url' => $this->client->avatar_url,
            ]),
            'system_type' => $this->whenLoaded('systemType', fn () => [
                'id' => $this->systemType->id,
                'name' => $this->systemType->name,
                'icon' => $this->systemType->icon,
            ]),
            // Billing details are admin-only; staff with credential access just see the system.
            'amount' => $this->when($isAdmin, fn () => (float) $this->amount),
            'billing_cycle' => $this->when($isAdmin, $this->billing_cycle),
            'regular_monthly_rate' => $this->when($isAdmin, fn () => $this->regular_monthly_rate === null ? null : (float) $this->regular_monthly_rate),
            'regular_cycle_amount' => $this->when($isAdmin, fn () => $this->regularCycleAmount()),
            'discount_amount' => $this->when($isAdmin, fn () => $this->discountAmount()),
            'discount_percent' => $this->when($isAdmin, fn () => $this->discountPercent()),
            'next_due_date' => $this->next_due_date->toDateString(),
            'started_on' => $this->started_on?->toDateString(),
            'billing_anchor_day' => $this->billing_anchor_day,
            'days_until_due' => $this->daysUntilDue(),
            'due_state' => $this->dueState(),
            'status' => $this->status,
            'login_url' => $this->login_url,
            'has_credentials' => $this->hasCredentials(),
            'notes' => $this->when($isAdmin, $this->notes),
            'last_paid_at' => $this->when($isAdmin && isset($this->last_paid_at), fn () => $this->last_paid_at),
            'created_at' => $this->created_at,
        ];
    }
}
