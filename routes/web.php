<?php

use App\Models\TicketAttachment;
use Illuminate\Support\Facades\Route;

// Serve DB-stored chat attachments. The long random token makes each URL
// unguessable (WhatsApp-style media links), so <img> tags work without headers.
Route::get('/files/{attachment}/{token}', function (TicketAttachment $attachment, string $token) {
    abort_unless(
        $attachment->token
        && hash_equals($attachment->token, $token)
        && $attachment->data !== null,
        404
    );

    return response($attachment->data, 200, [
        'Content-Type' => $attachment->mime_type,
        'Content-Disposition' => 'inline; filename="'.str_replace('"', '', $attachment->original_name).'"',
        'Cache-Control' => 'private, max-age=31536000, immutable',
        'X-Content-Type-Options' => 'nosniff',
    ]);
})->where('token', '[A-Za-z0-9]{40,64}');

// Serve the React SPA for every non-API path. Client-side router handles the rest.
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api|storage|broadcasting|files|up).*$');
