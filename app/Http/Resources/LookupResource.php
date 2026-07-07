<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LookupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return array_filter([
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'icon' => $this->icon ?? null,
            'color' => $this->color ?? null,
            'sla_hours' => $this->sla_hours ?? null,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
        ], fn ($v) => ! is_null($v));
    }
}
