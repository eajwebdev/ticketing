<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TicketMessage extends Model
{
    protected $fillable = ['ticket_id', 'user_id', 'reply_to_id', 'body', 'is_internal'];

    protected $casts = ['is_internal' => 'boolean'];

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(TicketMessage::class, 'reply_to_id');
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class, 'message_id');
    }

    public function mentions(): HasMany
    {
        return $this->hasMany(MessageMention::class, 'message_id');
    }
}
