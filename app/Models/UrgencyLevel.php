<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UrgencyLevel extends Model
{
    protected $fillable = ['name', 'description', 'color', 'sla_hours', 'is_active', 'sort_order'];

    protected $casts = ['is_active' => 'boolean', 'sla_hours' => 'integer'];

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'urgency_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
