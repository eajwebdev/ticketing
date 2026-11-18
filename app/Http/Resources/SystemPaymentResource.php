<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SystemPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client_system_id' => $this->client_system_id,
            'amount' => (float) $this->amount,
            'discount_amount' => (float) $this->discount_amount,
            'cycles' => (int) ($this->cycles ?? 1),
            'paid_at' => $this->paid_at->toDateString(),
            'covered_due_date' => $this->covered_due_date->toDateString(),
            'next_due_date' => $this->next_due_date->toDateString(),
            'method' => $this->method,
            'reference' => $this->reference,
            'notes' => $this->notes,
            'client' => $this->whenLoaded('client', fn () => [
                'id' => $this->client->id,
                'name' => $this->client->name,
                'store_name' => $this->client->store_name,
                'avatar_url' => $this->client->avatar_url,
            ]),
            'system_type' => $this->whenLoaded('systemType', fn () => [
                'id' => $this->systemType->id,
                'name' => $this->systemType->name,
                'icon' => $this->systemType->icon,
            ]),
            'system_name' => $this->whenLoaded('clientSystem', fn () => $this->clientSystem?->system_name),
            'label' => $this->whenLoaded('clientSystem', fn () => $this->clientSystem?->label),
            'recorded_by' => $this->whenLoaded('recorder', fn () => $this->recorder ? [
                'id' => $this->recorder->id,
                'name' => $this->recorder->name,
            ] : null),
            'created_at' => $this->created_at,
        ];
    }
}
