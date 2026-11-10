<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lead extends Model
{
    public const STAGES = ['new', 'contacted', 'demo', 'proposal', 'won', 'lost'];

    public const OPEN_STAGES = ['new', 'contacted', 'demo', 'proposal'];

    public const SOURCES = ['facebook', 'referral', 'website', 'walk_in', 'event', 'cold_call', 'other'];

    protected $fillable = [
        'business_name', 'contact_person', 'email', 'phone', 'business_type', 'source', 'system_type_id',
        'estimated_value', 'stage', 'owner_id', 'next_follow_up', 'last_reminded_on', 'notes', 'lost_reason',
        'converted_client_id', 'converted_at', 'created_by',
    ];

    protected $attributes = ['stage' => 'new', 'source' => 'other'];

    protected function casts(): array
    {
        return [
            'estimated_value' => 'decimal:2',
            'next_follow_up' => 'date',
            'last_reminded_on' => 'date',
            'converted_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function systemType(): BelongsTo
    {
        return $this->belongsTo(SystemType::class);
    }

    public function convertedClient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'converted_client_id');
    }

    public function isOpen(): bool
    {
        return in_array($this->stage, self::OPEN_STAGES, true);
    }
}
