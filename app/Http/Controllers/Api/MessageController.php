<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Events\UserTyping;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMessageRequest;
use App\Http\Resources\MessageResource;
use App\Http\Resources\UserResource;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Notifications\TicketNotification;
use App\Services\TicketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    public function __construct(private TicketService $service) {}

    public function index(Request $request, Ticket $ticket)
    {
        $this->authorize('view', $ticket);

        $query = $ticket->messages()
            ->with(['user', 'attachments', 'mentions.mentionedUser', 'replyTo.user'])
            ->orderBy('created_at');

        // Customers never see internal notes.
        if ($request->user()->isCustomer()) {
            $query->where('is_internal', false);
        }

        return MessageResource::collection($query->get());
    }

    public function store(StoreMessageRequest $request, Ticket $ticket)
    {
        $this->authorize('postMessage', $ticket);

        $user = $request->user();
        $isInternal = $request->boolean('is_internal');

        // Only team members may post internal notes.
        if ($isInternal && ! $user->isTeam()) {
            $isInternal = false;
        }

        // Quoted reply — must belong to this ticket; customers can't quote internal notes.
        $replyToId = $request->input('reply_to_id');
        if ($replyToId) {
            $target = TicketMessage::find($replyToId);
            if (! $target || $target->ticket_id !== $ticket->id || ($target->is_internal && ! $user->isTeam())) {
                $replyToId = null;
            }
        }

        $message = DB::transaction(function () use ($request, $ticket, $user, $isInternal, $replyToId) {
            $message = $ticket->messages()->create([
                'user_id' => $user->id,
                'reply_to_id' => $replyToId,
                'body' => $request->input('body'),
                'is_internal' => $isInternal,
            ]);

            // Attachments
            foreach ((array) $request->file('attachments', []) as $file) {
                $path = $file->store('attachments/'.$ticket->id, 'public');
                $ticket->attachments()->create([
                    'message_id' => $message->id,
                    'user_id' => $user->id,
                    'path' => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                ]);
            }

            // Mentions — team may mention assignees and the ticket's client.
            $mentionIds = collect($request->input('mentions', []))->unique();
            if ($user->isTeam() && $mentionIds->isNotEmpty()) {
                $eligible = $this->service->mentionableUsers($ticket);
                // On internal notes, never mention the client (they can't see them).
                if ($isInternal) {
                    $eligible = $eligible->filter(fn ($u) => $u->isTeam());
                }
                $eligibleIds = $eligible->pluck('id');
                foreach ($mentionIds->intersect($eligibleIds) as $mid) {
                    $message->mentions()->create(['mentioned_user_id' => $mid]);
                }
            }

            // First response tracking (first team message)
            if ($user->isTeam() && ! $ticket->first_response_at) {
                $ticket->update(['first_response_at' => now()]);
            }

            return $message;
        });

        $message->load(['user', 'attachments', 'mentions.mentionedUser', 'replyTo.user']);

        broadcast(new MessageSent($message))->toOthers();

        $this->dispatchNotifications($ticket, $message, $user, $isInternal);

        return new MessageResource($message);
    }

    protected function dispatchNotifications(Ticket $ticket, TicketMessage $message, $user, bool $isInternal): void
    {
        // Mention notifications
        foreach ($message->mentions as $mention) {
            $mention->mentionedUser?->notify(new TicketNotification('mention', $ticket, $user, ['message_id' => $message->id]));
        }

        $mentionedIds = $message->mentions->pluck('mentioned_user_id')->all();

        // New-message notifications to other participants
        $participants = collect([$ticket->customer])
            ->merge($ticket->assignees)
            ->filter()
            ->unique('id')
            ->reject(fn ($p) => $p->id === $user->id || in_array($p->id, $mentionedIds, true));

        foreach ($participants as $participant) {
            // internal notes never reach the customer
            if ($isInternal && $participant->isCustomer()) {
                continue;
            }
            $participant->notify(new TicketNotification('message', $ticket, $user, ['message_id' => $message->id]));
        }
    }

    public function typing(Request $request, Ticket $ticket)
    {
        $this->authorize('view', $ticket);

        broadcast(new UserTyping($ticket->id, $request->user()))->toOthers();

        return response()->noContent();
    }

    public function mentionable(Request $request, Ticket $ticket)
    {
        $this->authorize('view', $ticket);

        abort_unless($request->user()->isTeam(), 403);

        return UserResource::collection($this->service->mentionableUsers($ticket));
    }
}
