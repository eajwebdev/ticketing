<?php

use Illuminate\Support\Facades\Route;

// Serve the React SPA for every non-API path. Client-side router handles the rest.
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api|storage|broadcasting|up).*$');
