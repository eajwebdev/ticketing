<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Some systems are sold as a one-time setup fee plus a recurring subscription.
 *  - client_systems.setup_fee / setup_paid_at: the one-time fee and when it was settled.
 *  - system_payments.kind: 'subscription' (moves the due date) or 'setup' (one-time).
 *  - leads.monthly_fee: the recurring part of a deal (estimated_value is the one-time part).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_systems', function (Blueprint $table) {
            $table->decimal('setup_fee', 12, 2)->nullable()->after('amount');
            $table->date('setup_paid_at')->nullable()->after('setup_fee');
        });
        Schema::table('system_payments', function (Blueprint $table) {
            $table->string('kind', 20)->default('subscription')->after('client_system_id');
        });
        Schema::table('leads', function (Blueprint $table) {
            $table->decimal('monthly_fee', 12, 2)->nullable()->after('estimated_value');
        });
    }

    public function down(): void
    {
        Schema::table('leads', fn (Blueprint $table) => $table->dropColumn('monthly_fee'));
        Schema::table('system_payments', fn (Blueprint $table) => $table->dropColumn('kind'));
        Schema::table('client_systems', fn (Blueprint $table) => $table->dropColumn(['setup_fee', 'setup_paid_at']));
    }
};
