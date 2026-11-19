<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/** A scheduled (or one-time) payment we make to someone — see the payouts migration. */
class Payout extends Model
{
    /** Cycle => months. "once" is a single payment, then the payout is completed. */
    public const CYCLES = [
        'once' => 0,
        'monthly' => 1,
        'quarterly' => 3,
        'semiannual' => 6,
        'yearly' => 12,
    ];

    /** Suggestions — free text is allowed. Paid payouts land in Expenses under this category. */
    public const CATEGORIES = [
        'Salaries & Payroll', 'Maintenance', 'Marketing', 'Commission',
        'Rent & Utilities', 'Internet & Phone', 'Software & Subscriptions', 'Other',
    ];

    /** team = a user; external = outside person/agent; bill = a company bill (rent, internet, software…). */
    public const PAYEE_KINDS = ['team', 'external', 'bill'];

    public const STATUSES = ['active', 'paused', 'completed'];

    public const DUE_SOON_DAYS = 7;

    protected $fillable = [
        'payee_name', 'payee_user_id', 'payee_kind', 'category', 'description', 'amount', 'cycle',
        'next_due_date', 'anchor_day', 'client_system_id', 'status', 'payout_method', 'payout_account',
        'notes', 'created_by',
    ];

    protected $attributes = ['status' => 'active', 'cycle' => 'monthly', 'payee_kind' => 'team'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'next_due_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        // Anchor on create; an edit of the due date re-anchors in the controller.
        // Marking paid deliberately does NOT, so Jan 31 → Feb 28 → Mar 31.
        static::creating(function (Payout $p) {
            $p->anchor_day ??= $p->next_due_date->day;
        });
    }

    public function payeeUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'payee_user_id');
    }

    public function clientSystem(): BelongsTo
    {
        return $this->belongsTo(ClientSystem::class);
    }

    /** Each "Mark paid" is an Expense. */
    public function payments(): HasMany
    {
        return $this->hasMany(Expense::class)->orderByDesc('spent_on')->orderByDesc('id');
    }

    public function latestPayment(): HasOne
    {
        return $this->hasOne(Expense::class)->ofMany(['spent_on' => 'max', 'id' => 'max']);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeRecurring($query)
    {
        return $query->where('cycle', '!=', 'once');
    }

    public function scopeOverdue($query)
    {
        return $query->active()->whereDate('next_due_date', '<', today());
    }

    public function scopeDueSoon($query)
    {
        return $query->active()->whereDate('next_due_date', '<=', today()->addDays(self::DUE_SOON_DAYS));
    }

    public function isOnce(): bool
    {
        return $this->cycle === 'once';
    }

    public function daysUntilDue(): int
    {
        return (int) today()->diffInDays($this->next_due_date, false);
    }

    /** overdue | due_today | due_soon | upcoming | paused | completed — same keys as client systems. */
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

    /** Normalised to one month for "monthly commitments"; one-time payouts count as 0. */
    public function monthlyValue(): float
    {
        $months = self::CYCLES[$this->cycle] ?? 1;

        return $months ? round((float) $this->amount / $months, 2) : 0.0;
    }

    /** Due date after paying $cycles cycles from $from, pinned to the anchor day. */
    public function dueDateAfterCycles(CarbonInterface $from, int $cycles = 1): Carbon
    {
        $months = (self::CYCLES[$this->cycle] ?? 1) * max(1, $cycles);
        $next = Carbon::parse($from)->startOfMonth()->addMonths($months);

        return $next->setDay(min($this->anchor_day ?: $from->day, $next->daysInMonth));
    }

    /** Plain array for the API and the dashboard. Expects clientSystem.client/systemType + payeeUser loaded. */
    public function present(): array
    {
        $cs = $this->clientSystem;
        $systemMonthly = $cs ? $cs->monthlyValue() : null;

        return [
            'id' => $this->id,
            'payee_name' => $this->payee_name,
            'payee_user' => $this->payeeUser ? [
                'id' => $this->payeeUser->id, 'name' => $this->payeeUser->name, 'avatar_url' => $this->payeeUser->avatar_url,
            ] : null,
            'payee_kind' => $this->payee_kind,
            'category' => $this->category,
            'description' => $this->description,
            'amount' => (float) $this->amount,
            'monthly_value' => $this->monthlyValue(),
            'cycle' => $this->cycle,
            'next_due_date' => $this->next_due_date->toDateString(),
            'days_until_due' => $this->daysUntilDue(),
            'due_state' => $this->dueState(),
            'status' => $this->status,
            'payout_method' => $this->payout_method,
            'payout_account' => $this->payout_account,
            'notes' => $this->notes,
            // The client system this payout is tied to (e.g. a commission), and whether
            // that client has paid us — so you know if the money is in before paying out.
            'client_system' => $cs ? [
                'id' => $cs->id,
                'display_name' => $cs->displayName(),
                'client_name' => $cs->client?->store_name ?: $cs->client?->name,
                'amount' => (float) $cs->amount,
                'billing_cycle' => $cs->billing_cycle,
                'monthly_value' => $systemMonthly,
                'next_due_date' => $cs->next_due_date->toDateString(),
                'due_state' => $cs->dueState(),
                'days_until_due' => $cs->daysUntilDue(),
                'share_percent' => $systemMonthly > 0 && ! $this->isOnce()
                    ? round($this->monthlyValue() / $systemMonthly * 100, 1) : null,
            ] : null,
            'last_paid' => ($last = $this->relationLoaded('latestPayment') ? $this->latestPayment : null)
                ? ['amount' => (float) $last->amount, 'spent_on' => $last->spent_on->toDateString()] : null,
        ];
    }
}
