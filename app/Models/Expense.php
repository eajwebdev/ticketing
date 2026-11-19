<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    /** Suggested categories — free text is allowed, these just keep reports tidy. */
    public const CATEGORIES = [
        'Hosting & Domains',
        'Software & Subscriptions',
        'Salaries & Payroll',
        'Rent & Utilities',
        'Internet & Phone',
        'Marketing & Ads',
        'Equipment',
        'Transportation',
        'Taxes & Fees',
        'Office Supplies',
        'Other',
    ];

    protected $fillable = [
        'spent_on', 'category', 'description', 'amount', 'payee', 'method', 'reference', 'notes', 'recorded_by',
        'payout_id', 'client_system_id', 'covered_due_date',
    ];

    protected function casts(): array
    {
        return [
            'spent_on' => 'date',
            'amount' => 'decimal:2',
            'covered_due_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        // Deleting a payout's latest payment is an "undo": put its due date back
        // (and reopen a one-time payout), wherever the delete came from.
        static::deleted(function (Expense $expense) {
            if (! $expense->payout_id || ! $expense->covered_due_date) {
                return;
            }
            $payout = Payout::find($expense->payout_id);
            if (! $payout) {
                return;
            }
            $newer = $payout->payments()->where(fn ($q) => $q->where('spent_on', '>', $expense->spent_on)
                ->orWhere(fn ($w) => $w->where('spent_on', $expense->spent_on)->where('id', '>', $expense->id)))->exists();
            if ($newer) {
                return; // an older payment — leave the schedule alone
            }
            $payout->update([
                'next_due_date' => $expense->covered_due_date,
                'status' => $payout->status === 'completed' ? 'active' : $payout->status,
            ]);
        });
    }

    public function payout(): BelongsTo
    {
        return $this->belongsTo(Payout::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
