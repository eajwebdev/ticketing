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
    ];

    protected function casts(): array
    {
        return [
            'spent_on' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
