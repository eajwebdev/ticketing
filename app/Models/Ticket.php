<?php

namespace App\Models;

use App\Enums\TicketStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ticket extends Model
{
    protected $fillable = [
        'ticket_number', 'customer_id', 'system_type_id', 'category_id', 'urgency_id',
        'subject', 'description', 'status', 'accepted_by', 'resolved_by',
        'accepted_at', 'resolved_at', 'closed_at', 'first_response_at', 'expected_resolution_at',
    ];

    protected $casts = [
        'status' => TicketStatus::class,
        'accepted_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
        'first_response_at' => 'datetime',
        'expected_resolution_at' => 'datetime',
    ];

    protected $appends = ['response_time_minutes', 'resolution_time_minutes'];

    // Relationships
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function systemType(): BelongsTo
    {
        return $this->belongsTo(SystemType::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function urgency(): BelongsTo
    {
        return $this->belongsTo(UrgencyLevel::class, 'urgency_id');
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'ticket_assignees')
            ->withPivot('is_primary', 'added_by')
            ->withTimestamps();
    }

    public function messages(): HasMany
    {
        return $this->hasMany(TicketMessage::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(TicketActivity::class);
    }

    // Computed durations (in minutes)
    public function getResponseTimeMinutesAttribute(): ?int
    {
        return $this->accepted_at ? $this->created_at->diffInMinutes($this->accepted_at) : null;
    }

    public function getResolutionTimeMinutesAttribute(): ?int
    {
        return $this->resolved_at ? $this->created_at->diffInMinutes($this->resolved_at) : null;
    }

    // Helpers
    public function isParticipant(User $user): bool
    {
        if ($user->id === $this->customer_id) {
            return true;
        }

        return $this->assignees()->where('users.id', $user->id)->exists();
    }

    public function generateNumber(): string
    {
        return 'EAJ-'.str_pad((string) $this->id, 6, '0', STR_PAD_LEFT);
    }
}
