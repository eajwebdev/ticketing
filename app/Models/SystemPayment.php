<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemPayment extends Model
{
    public const METHODS = ['cash', 'gcash', 'maya', 'bank_transfer', 'check', 'other'];

    protected $fillable = [
        'client_system_id', 'client_id', 'system_type_id', 'amount', 'discount_amount', 'cycles', 'paid_at',
        'covered_due_date', 'next_due_date', 'method', 'reference', 'notes', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'paid_at' => 'date',
            'covered_due_date' => 'date',
            'next_due_date' => 'date',
        ];
    }

    public function clientSystem(): BelongsTo
    {
        return $this->belongsTo(ClientSystem::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function systemType(): BelongsTo
    {
        return $this->belongsTo(SystemType::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
