<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'role' => $this->role->value,
            'avatar_url' => $this->avatar_url,
            'position' => $this->position,
            'department' => $this->department,
            'bio' => $this->bio,
            'stats' => $this->when(isset($this->stats), fn () => $this->stats),
        ];
    }
}
