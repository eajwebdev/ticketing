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

            // Attachments — stored in the DB as compressed blobs (images are downscaled
            // and re-encoded to JPEG, typically just tens of KB). No disk, no storage:link.
            foreach ((array) $request->file('attachments', []) as $file) {
                $bytes = file_get_contents($file->getRealPath());
                $mime = $file->getMimeType();
                $name = $file->getClientOriginalName();

                if (str_starts_with((string) $mime, 'image/')) {
                    [$bytes, $mime, $name] = $this->compressImage($bytes, $mime, $name);
                }

                $ticket->attachments()->create([
                    'message_id' => $message->id,
                    'user_id' => $user->id,
                    'token' => \Illuminate\Support\Str::random(48),
                    'data' => $bytes,
                    'original_name' => $name,
                    'mime_type' => $mime,
                    'size' => strlen($bytes),
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

    /**
     * Downscale to max 1400px and re-encode as JPEG (q72) so chat images stay
     * kilobyte-sized in the database. Animated GIFs are kept as-is.
     */
    private function compressImage(string $bytes, ?string $mime, string $name): array
    {
        if ($mime === 'image/gif' || ! extension_loaded('gd')) {
            return [$bytes, $mime, $name];
        }

        try {
            $src = @imagecreatefromstring($bytes);
            if (! $src) {
                return [$bytes, $mime, $name];
            }

            $w = imagesx($src);
            $h = imagesy($src);
            $max = 1400;

            if ($w > $max || $h > $max) {
                $scale = min($max / $w, $max / $h);
                $nw = (int) round($w * $scale);
                $nh = (int) round($h * $scale);
                $dst = imagecreatetruecolor($nw, $nh);
                // Flatten transparency onto white for JPEG output.
                $white = imagecolorallocate($dst, 255, 255, 255);
                imagefill($dst, 0, 0, $white);
                imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
                imagedestroy($src);
                $src = $dst;
            }

            ob_start();
            imagejpeg($src, null, 72);
            $out = ob_get_clean();
            imagedestroy($src);

            if ($out === false || $out === '') {
                return [$bytes, $mime, $name];
            }

            // Only keep the re-encode when it actually saves space.
            if (strlen($out) >= strlen($bytes)) {
                return [$bytes, $mime, $name];
            }

            $newName = preg_replace('/\.[^.]+$/', '', $name).'.jpg';

            return [$out, 'image/jpeg', $newName];
        } catch (\Throwable) {
            return [$bytes, $mime, $name];
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
