<?php

namespace App\Models;

use App\Support\Permissions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    public const STATUSES = ['todo', 'in_progress', 'review', 'done'];

    public const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

    public const TYPES = ['feature', 'bug', 'improvement', 'design', 'marketing', 'support', 'other'];

    protected $fillable = [
        'title', 'description', 'status', 'priority', 'type', 'assignee_id', 'created_by',
        'client_id', 'client_system_id', 'ticket_id', 'due_date', 'completed_at', 'position',
    ];

    protected $attributes = ['status' => 'todo', 'priority' => 'medium', 'type' => 'feature', 'position' => 0];

    protected function casts(): array
    {
        return ['due_date' => 'date', 'completed_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::saving(function (Task $task) {
            if ($task->isDirty('status')) {
                $task->completed_at = $task->status === 'done' ? ($task->completed_at ?? now()) : null;
            }
        });
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function clientSystem(): BelongsTo
    {
        return $this->belongsTo(ClientSystem::class);
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    /** Your own tasks (created or assigned) are yours to change; others need tasks.manage. */
    public function canBeEditedBy(User $user): bool
    {
        return $user->hasPermission(Permissions::TASKS_MANAGE)
            || $this->created_by === $user->id
            || $this->assignee_id === $user->id;
    }

    public function isOverdue(): bool
    {
        return $this->status !== 'done' && $this->due_date && $this->due_date->lt(today());
    }
}
