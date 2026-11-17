<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lock-in subscriptions (e.g. pay yearly at a discount):
 *  - client_systems.regular_monthly_rate: what the client would pay month-to-month,
 *    so we can show how much the lock-in saves them.
 *  - system_payments.discount_amount: discount given on that payment (snapshot for Sales).
 * Plus:
 *  - client_systems.started_on: when the subscription began ("client since").
 *  - system_payments.cycles: how many billing cycles one payment covered (advance payments).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_systems', function (Blueprint $table) {
            $table->decimal('regular_monthly_rate', 12, 2)->nullable()->after('amount');
            $table->date('started_on')->nullable()->after('billing_cycle');
        });
        Schema::table('system_payments', function (Blueprint $table) {
            $table->decimal('discount_amount', 12, 2)->default(0)->after('amount');
            $table->unsignedSmallInteger('cycles')->default(1)->after('discount_amount');
        });

        // Existing systems: best guess for the start is when they were added.
        DB::table('client_systems')->whereNull('started_on')
            ->update(['started_on' => DB::raw('DATE(created_at)')]);
    }

    public function down(): void
    {
        Schema::table('system_payments', function (Blueprint $table) {
            $table->dropColumn(['discount_amount', 'cycles']);
        });
        Schema::table('client_systems', function (Blueprint $table) {
            $table->dropColumn(['regular_monthly_rate', 'started_on']);
        });
    }
};
