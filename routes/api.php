<?php

use App\Http\Controllers\Api\Admin\AnalyticsController;
use App\Http\Controllers\Api\Admin\ClientController;
use App\Http\Controllers\Api\Admin\ClientSystemController;
use App\Http\Controllers\Api\Admin\SalesController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\TaskController;
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
    Route::post('auth/google', [AuthController::class, 'google'])->middleware('throttle:20,1');

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
        Route::get('ticket-systems', [TicketController::class, 'systems']);
        Route::get('tickets/{ticket}', [TicketController::class, 'show']);
        Route::patch('tickets/{ticket}', [TicketController::class, 'update']);
        Route::post('tickets/{ticket}/accept', [TicketController::class, 'accept']);
        Route::post('tickets/{ticket}/resolve', [TicketController::class, 'resolve']);
        Route::post('tickets/{ticket}/reopen', [TicketController::class, 'reopen']);
        Route::post('tickets/{ticket}/eta', [TicketController::class, 'setEta']);

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
                User::team()->where('is_active', true)->orderBy('name')->get()
            );
        });

        // Notifications
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'read']);

        // Live team dashboard — one permission-aware snapshot, polled by the page.
        Route::get('dashboard', [\App\Http\Controllers\Api\DashboardController::class, 'index']);

        // Tasks — every team member (controller checks ownership / tasks.manage)
        Route::get('tasks', [TaskController::class, 'index']);
        Route::post('tasks', [TaskController::class, 'store']);
        Route::patch('tasks/{task}', [TaskController::class, 'update']);
        Route::post('tasks/{task}/move', [TaskController::class, 'move']);
        Route::delete('tasks/{task}', [TaskController::class, 'destroy']);

        // Leads pipeline
        Route::middleware('perm:leads.manage')->group(function () {
            Route::get('leads', [LeadController::class, 'index']);
            Route::post('leads', [LeadController::class, 'store']);
            Route::patch('leads/{lead}', [LeadController::class, 'update']);
            Route::post('leads/{lead}/move', [LeadController::class, 'move']);
            Route::post('leads/{lead}/convert', [LeadController::class, 'convert'])->middleware('perm:clients.manage');
            Route::delete('leads/{lead}', [LeadController::class, 'destroy']);
        });

        Route::prefix('admin')->group(function () {
            // Client systems: list for anyone with systems/credentials/billing access; money & edits need billing.
            Route::get('client-systems', [ClientSystemController::class, 'index']);
            Route::get('client-systems/{clientSystem}/credentials', [ClientSystemController::class, 'credentials'])
                ->middleware('throttle:30,1');

            Route::middleware('perm:billing.manage')->group(function () {
                Route::get('billing/overview', [ClientSystemController::class, 'overview']);
                Route::post('client-systems', [ClientSystemController::class, 'store']);
                Route::patch('client-systems/{clientSystem}', [ClientSystemController::class, 'update']);
                Route::delete('client-systems/{clientSystem}', [ClientSystemController::class, 'destroy']);
                Route::post('client-systems/{clientSystem}/pay', [ClientSystemController::class, 'pay']);
                Route::post('client-systems/{clientSystem}/pay-setup', [ClientSystemController::class, 'paySetup']);
                Route::get('client-systems/{clientSystem}/payments', [ClientSystemController::class, 'payments']);

                Route::get('sales', [SalesController::class, 'index']);
                Route::get('sales/export', [SalesController::class, 'export']);
                Route::delete('sales/{payment}', [SalesController::class, 'destroy']);

                // Expenses — paired with sales to show profit.
                Route::get('expenses', [\App\Http\Controllers\Api\Admin\ExpenseController::class, 'index']);
                Route::post('expenses', [\App\Http\Controllers\Api\Admin\ExpenseController::class, 'store']);
                Route::patch('expenses/{expense}', [\App\Http\Controllers\Api\Admin\ExpenseController::class, 'update']);
                Route::delete('expenses/{expense}', [\App\Http\Controllers\Api\Admin\ExpenseController::class, 'destroy']);

                // Payouts — what we pay team members / agents on a schedule; each payment is an expense.
                Route::get('payouts', [\App\Http\Controllers\Api\Admin\PayoutController::class, 'index']);
                Route::post('payouts', [\App\Http\Controllers\Api\Admin\PayoutController::class, 'store']);
                Route::post('payouts/pay-bulk', [\App\Http\Controllers\Api\Admin\PayoutController::class, 'payBulk']);
                Route::patch('payouts/{payout}', [\App\Http\Controllers\Api\Admin\PayoutController::class, 'update']);
                Route::delete('payouts/{payout}', [\App\Http\Controllers\Api\Admin\PayoutController::class, 'destroy']);
                Route::post('payouts/{payout}/pay', [\App\Http\Controllers\Api\Admin\PayoutController::class, 'pay']);
                Route::get('payouts/{payout}/payments', [\App\Http\Controllers\Api\Admin\PayoutController::class, 'payments']);
                Route::delete('payouts/{payout}/payments/{expense}', [\App\Http\Controllers\Api\Admin\PayoutController::class, 'voidPayment']);
            });

            // Company subscriptions — domains, hosting, VPS and their expiry.
            Route::middleware('perm:subscriptions.manage')->group(function () {
                Route::get('subscriptions', [\App\Http\Controllers\Api\Admin\SubscriptionController::class, 'index']);
                Route::post('subscriptions', [\App\Http\Controllers\Api\Admin\SubscriptionController::class, 'store']);
                Route::patch('subscriptions/{subscription}', [\App\Http\Controllers\Api\Admin\SubscriptionController::class, 'update']);
                Route::delete('subscriptions/{subscription}', [\App\Http\Controllers\Api\Admin\SubscriptionController::class, 'destroy']);
                Route::post('subscriptions/{subscription}/renew', [\App\Http\Controllers\Api\Admin\SubscriptionController::class, 'renew']);
            });

            // Client list is also needed by billing/leads/ticket staff to pick a client.
            Route::get('clients', [ClientController::class, 'index'])
                ->middleware('perm:clients.manage,billing.manage,tickets.handle,leads.manage');
            Route::middleware('perm:clients.manage')->group(function () {
                Route::post('clients', [ClientController::class, 'store']);
                Route::post('clients/{user}/approve', [ClientController::class, 'approve']);
                Route::post('clients/{user}/reject', [ClientController::class, 'reject']);
                Route::patch('clients/{user}', [ClientController::class, 'update']);
                Route::post('clients/{user}', [ClientController::class, 'update']);
            });

            Route::middleware('perm:analytics.view')->group(function () {
                Route::get('analytics', [AnalyticsController::class, 'index']);
                Route::get('analytics/export', [AnalyticsController::class, 'export']);
            });

            Route::middleware('perm:settings.manage')->group(function () {
                Route::get('team', [TeamController::class, 'index']);
                Route::post('team', [TeamController::class, 'store']);
                Route::patch('team/{user}', [TeamController::class, 'update']);
                Route::post('team/{user}', [TeamController::class, 'update']);

                Route::get('lookups/{type}', [LookupCrudController::class, 'index']);
                Route::post('lookups/{type}', [LookupCrudController::class, 'store']);
                Route::patch('lookups/{type}/{id}', [LookupCrudController::class, 'update']);
                Route::delete('lookups/{type}/{id}', [LookupCrudController::class, 'destroy']);

                Route::get('roles', [UserManagementController::class, 'roles']);
                Route::get('users', [UserManagementController::class, 'index']);
                Route::post('users', [UserManagementController::class, 'store']);
                Route::patch('users/{user}', [UserManagementController::class, 'update']);
                Route::post('users/{user}/reset-password', [UserManagementController::class, 'resetPassword']);
            });
        });
    });
});
