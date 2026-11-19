<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class Subscription extends Model
{
    public const TYPES = [
        'domain' => 'Domain',
        'hosting' => 'Hosting',
        'vps' => 'VPS / Server',
        'ssl' => 'SSL certificate',
        'email' => 'Email / Workspace',
        'software' => 'Software / License',
        'other' => 'Other',
    ];

    /** Billing cycle => months. Domains are often bought for 2–3 years at a time. */
    public const CYCLES = [
        'monthly' => 1,
        'quarterly' => 3,
        'semiannual' => 6,
        'yearly' => 12,
        'biennial' => 24,
        'triennial' => 36,
    ];

    public const STATUSES = ['active', 'cancelled'];

    /** "Expiring soon" window used by filters, badges and the header counters. */
    public const SOON_DAYS = 30;

    protected $fillable = [
        'type', 'name', 'provider', 'client_system_id', 'client_id', 'paid_by', 'cost', 'billing_cycle',
        'expires_on', 'auto_renew', 'status', 'login_url', 'account', 'notes',
        'last_alert_stage', 'last_alerted_on', 'created_by',
    ];

    protected $attributes = ['status' => 'active', 'paid_by' => 'company', 'billing_cycle' => 'yearly'];

    protected function casts(): array
    {
        return [
            'cost' => 'decimal:2',
            'expires_on' => 'date',
            'last_alerted_on' => 'date',
            'auto_renew' => 'boolean',
            'last_alert_stage' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // A new expiry date starts the alert ladder (30 → 14 → … days) over again.
        static::saving(function (Subscription $sub) {
            if ($sub->exists && $sub->isDirty('expires_on')) {
                $sub->last_alert_stage = null;
                $sub->last_alerted_on = null;
            }
        });
    }

    public function clientSystem(): BelongsTo
    {
        return $this->belongsTo(ClientSystem::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeExpired($query)
    {
        return $query->active()->whereDate('expires_on', '<', today());
    }

    public function scopeExpiringSoon($query)
    {
        return $query->active()->whereBetween('expires_on', [
            today()->toDateString(),
            today()->addDays(self::SOON_DAYS)->toDateString(),
        ]);
    }

    /** Whole days until expiry; negative once expired. */
    public function daysUntilExpiry(): int
    {
        return (int) today()->diffInDays($this->expires_on, false);
    }

    /** expired | expires_today | expiring_soon | active | cancelled */
    public function expiryState(): string
    {
        if ($this->status !== 'active') {
            return $this->status;
        }
        $days = $this->daysUntilExpiry();

        return match (true) {
            $days < 0 => 'expired',
            $days === 0 => 'expires_today',
            $days <= self::SOON_DAYS => 'expiring_soon',
            default => 'active',
        };
    }

    public function months(): int
    {
        return self::CYCLES[$this->billing_cycle] ?? 12;
    }

    /** The expiry date after one more cycle from $from (defaults to the current expiry). */
    public function nextExpiryAfter(?CarbonInterface $from = null): Carbon
    {
        return Carbon::parse($from ?? $this->expires_on)->addMonthsNoOverflow($this->months());
    }

    /** Cost normalised to a year, for the "yearly spend" figure. */
    public function yearlyCost(): float
    {
        return $this->cost === null ? 0.0 : round((float) $this->cost * 12 / $this->months(), 2);
    }

    public function typeLabel(): string
    {
        return self::TYPES[$this->type] ?? ucfirst($this->type);
    }

    /** "juanlaundry.com (Domain)" — used in alerts. */
    public function displayName(): string
    {
        return "{$this->name} ({$this->typeLabel()})";
    }

    /** Pull a bare domain out of a URL (or a pasted domain): "https://www.juan.com/login" → "juan.com". */
    public static function domainFromUrl(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }
        if (! preg_match('~^[a-z][a-z0-9+.-]*://~i', $url)) {
            $url = "http://{$url}";
        }
        $host = mb_strtolower((string) parse_url($url, PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host);

        // Skip IPs, localhost and anything that isn't a real domain.
        if ($host === '' || filter_var($host, FILTER_VALIDATE_IP) || ! str_contains($host, '.')) {
            return null;
        }

        return $host;
    }
}
