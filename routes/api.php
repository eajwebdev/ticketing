<?php

use App\Http\Controllers\Api\Admin\AnalyticsController;
use App\Http\Controllers\Api\Admin\ClientController;
use App\Http\Controllers\Api\Admin\LookupCrudController;
use App\Http\Controllers\Api\Admin\TeamController;
use App\Http\Controllers\Api\Admin\UserManagementController;
use App\Http\Controllers\Api\AssigneeController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LookupController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public auth
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);

    // Public landing stats (real, cached)
    Route::get('stats', [\App\Http\Controllers\Api\StatsController::class, 'index']);

    // Public lookups (for the landing page / create-ticket form)
    Route::get('lookups', [LookupController::class, 'all']);
    Route::get('system-types', [LookupController::class, 'systemTypes']);
    Route::get('categories', [LookupController::class, 'categories']);
    Route::get('urgency-levels', [LookupController::class, 'urgencyLevels']);

    // Public team directory & profiles
    Route::get('team', [ProfileController::class, 'team']);
    Route::get('users/{user}/profile', [ProfileController::class, 'show']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::patch('me', [ProfileController::class, 'update']);
        Route::post('me', [ProfileController::class, 'update']); // multipart avatar upload

        // Tickets
        Route::get('tickets', [TicketController::class, 'index']);
        Route::post('tickets', [TicketController::class, 'store']);
        Route::get('tickets/{ticket}', [TicketController::class, 'show']);
        Route::patch('tickets/{ticket}', [TicketController::class, 'update']);
        Route::post('tickets/{ticket}/accept', [TicketController::class, 'accept']);
        Route::post('tickets/{ticket}/resolve', [TicketController::class, 'resolve']);
        Route::post('tickets/{ticket}/reopen', [TicketController::class, 'reopen']);

        // Collaborators
        Route::post('tickets/{ticket}/assignees', [AssigneeController::class, 'store']);
        Route::delete('tickets/{ticket}/assignees/{user}', [AssigneeController::class, 'destroy']);

        // Chat
        Route::get('tickets/{ticket}/messages', [MessageController::class, 'index']);
        Route::post('tickets/{ticket}/messages', [MessageController::class, 'store']);
        Route::post('tickets/{ticket}/typing', [MessageController::class, 'typing']);
        Route::get('tickets/{ticket}/mentionable', [MessageController::class, 'mentionable']);

        // Team members list (for adding collaborators) — team only
        Route::get('team-members', function (Request $request) {
            abort_unless($request->user()->isTeam(), 403);

            return UserResource::collection(
                User::whereIn('role', ['agent', 'admin'])->where('is_active', true)->orderBy('name')->get()
            );
        });

        // Notifications
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'read']);

        // Admin
        Route::prefix('admin')->middleware('role:admin')->group(function () {
            Route::get('clients', [ClientController::class, 'index']);
            Route::post('clients', [ClientController::class, 'store']);
            Route::post('clients/{user}/approve', [ClientController::class, 'approve']);
            Route::post('clients/{user}/reject', [ClientController::class, 'reject']);
            Route::patch('clients/{user}', [ClientController::class, 'update']);
            Route::post('clients/{user}', [ClientController::class, 'update']);

            Route::get('team', [TeamController::class, 'index']);
            Route::post('team', [TeamController::class, 'store']);
            Route::patch('team/{user}', [TeamController::class, 'update']);
            Route::post('team/{user}', [TeamController::class, 'update']);

            Route::get('lookups/{type}', [LookupCrudController::class, 'index']);
            Route::post('lookups/{type}', [LookupCrudController::class, 'store']);
            Route::patch('lookups/{type}/{id}', [LookupCrudController::class, 'update']);
            Route::delete('lookups/{type}/{id}', [LookupCrudController::class, 'destroy']);

            Route::get('users', [UserManagementController::class, 'index']);
            Route::patch('users/{user}', [UserManagementController::class, 'update']);

            Route::get('analytics', [AnalyticsController::class, 'index']);
            Route::get('analytics/export', [AnalyticsController::class, 'export']);
        });
    });
});
