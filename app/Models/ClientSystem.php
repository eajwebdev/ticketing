<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class ClientSystem extends Model
{
    /** Billing cycle => months per cycle. */
    public const CYCLES = [
        'monthly' => 1,
        'quarterly' => 3,
        'semiannual' => 6,
        'yearly' => 12,
    ];

    public const STATUSES = ['active', 'paused', 'cancelled'];

    /** Days before the due date that admins get a heads-up. */
    public const REMIND_DAYS_BEFORE = [7, 3];

    /** "Due soon" window used by filters and badges. */
    public const DUE_SOON_DAYS = 7;

    protected $fillable = [
        'client_id', 'system_type_id', 'label', 'amount', 'billing_cycle', 'next_due_date',
        'billing_anchor_day', 'status', 'login_url', 'username', 'password', 'notes',
        'last_reminded_on', 'created_by',
    ];

    protected $hidden = ['username', 'password'];

    protected $attributes = ['status' => 'active'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'next_due_date' => 'date',
            'last_reminded_on' => 'date',
            'username' => 'encrypted',
            'password' => 'encrypted',
        ];
    }

    protected static function booted(): void
    {
        // Remember the day of month the client is billed on, so a 31st due date
        // goes Jan 31 → Feb 28 → Mar 31 instead of drifting to the 28th forever.
        // Set on create; edits to the due date re-anchor in the controller. Marking
        // paid deliberately does NOT re-anchor.
        static::creating(function (ClientSystem $system) {
            $system->billing_anchor_day ??= $system->next_due_date->day;
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function systemType(): BelongsTo
    {
        return $this->belongsTo(SystemType::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SystemPayment::class)->latest('paid_at')->latest('id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeOverdue($query)
    {
        return $query->active()->whereDate('next_due_date', '<', today());
    }

    public function scopeDueSoon($query)
    {
        return $query->active()->whereBetween('next_due_date', [
            today()->toDateString(),
            today()->addDays(self::DUE_SOON_DAYS)->toDateString(),
        ]);
    }

    public function hasCredentials(): bool
    {
        return filled($this->getRawOriginal('username')) || filled($this->getRawOriginal('password'));
    }

    /** Whole days until the due date; negative when overdue. */
    public function daysUntilDue(): int
    {
        return (int) today()->diffInDays($this->next_due_date, false);
    }

    public function dueState(): string
    {
        if ($this->status !== 'active') {
            return $this->status;
        }
        $days = $this->daysUntilDue();

        return match (true) {
            $days < 0 => 'overdue',
            $days === 0 => 'due_today',
            $days <= self::DUE_SOON_DAYS => 'due_soon',
            default => 'upcoming',
        };
    }

    /** The due date one billing cycle after $from, pinned to the anchor day. */
    public function nextDueDateAfter(CarbonInterface $from): Carbon
    {
        $months = self::CYCLES[$this->billing_cycle] ?? 1;
        $next = Carbon::parse($from)->startOfMonth()->addMonths($months);
        $day = min($this->billing_anchor_day ?: $from->day, $next->daysInMonth);

        return $next->setDay($day);
    }

    /** Recurring revenue normalised to one month, for the MRR figure. */
    public function monthlyValue(): float
    {
        return (float) $this->amount / (self::CYCLES[$this->billing_cycle] ?? 1);
    }

    public function displayName(): string
    {
        $name = $this->systemType?->name ?? 'System';

        return $this->label ? "{$name} ({$this->label})" : $name;
    }
}
