<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $followUp = $this->next_follow_up;

        return [
            'id' => $this->id,
            'business_name' => $this->business_name,
            'contact_person' => $this->contact_person,
            'email' => $this->email,
            'phone' => $this->phone,
            'business_type' => $this->business_type,
            'source' => $this->source,
            'stage' => $this->stage,
            // estimated_value = one-time setup fee; monthly_fee = recurring subscription.
            'estimated_value' => $this->estimated_value !== null ? (float) $this->estimated_value : null,
            'monthly_fee' => $this->monthly_fee !== null ? (float) $this->monthly_fee : null,
            'next_follow_up' => $followUp?->toDateString(),
            'follow_up_due' => $this->resource->isOpen() && $followUp && $followUp->lte(today()),
            'notes' => $this->notes,
            'lost_reason' => $this->lost_reason,
            'system_type' => $this->whenLoaded('systemType', fn () => $this->systemType ? [
                'id' => $this->systemType->id, 'name' => $this->systemType->name, 'icon' => $this->systemType->icon,
            ] : null),
            'owner' => $this->whenLoaded('owner', fn () => $this->owner ? [
                'id' => $this->owner->id, 'name' => $this->owner->name, 'avatar_url' => $this->owner->avatar_url,
            ] : null),
            'converted_client' => $this->whenLoaded('convertedClient', fn () => $this->convertedClient ? [
                'id' => $this->convertedClient->id, 'name' => $this->convertedClient->name,
            ] : null),
            'converted_at' => $this->converted_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
