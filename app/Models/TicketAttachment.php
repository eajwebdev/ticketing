<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class TicketAttachment extends Model
{
    protected $fillable = ['ticket_id', 'message_id', 'user_id', 'path', 'token', 'data', 'original_name', 'mime_type', 'size'];

    protected $appends = ['url', 'is_image'];

    // Never serialize raw file bytes into API responses.
    protected $hidden = ['data'];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(TicketMessage::class, 'message_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getUrlAttribute(): string
    {
        // DB-stored blob served via tokenized route; legacy rows fall back to disk URL.
        if ($this->token) {
            return "/files/{$this->id}/{$this->token}";
        }

        return $this->path ? Storage::url($this->path) : '';
    }

    public function getIsImageAttribute(): bool
    {
        return str_starts_with((string) $this->mime_type, 'image/');
    }
}
