<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Money we pay out to people on a schedule (or once): a developer's monthly maintenance fee,
 * a marketing allowance, an outside agent's commission on a client system…
 * Each "Mark paid" is saved as an Expense linked back here, so profit stays accurate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->string('payee_name');
            $table->foreignId('payee_user_id')->nullable()->constrained('users')->nullOnDelete(); // team member, if any
            $table->string('payee_kind', 20)->default('team');      // team | external
            $table->string('category', 100);                        // Maintenance, Marketing, Commission…
            $table->string('description')->nullable();              // "Maintains all client systems"
            $table->decimal('amount', 12, 2);
            $table->string('cycle', 20)->default('monthly');        // once | monthly | quarterly | semiannual | yearly
            $table->date('next_due_date')->index();
            $table->unsignedTinyInteger('anchor_day')->nullable();  // keeps a 31st from drifting to the 28th
            $table->foreignId('client_system_id')->nullable()->constrained('client_systems')->nullOnDelete();
            $table->string('status', 20)->default('active')->index(); // active | paused | completed
            $table->string('payout_method', 30)->nullable();        // usual way we pay them
            $table->string('payout_account')->nullable();           // e.g. GCash number
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignId('payout_id')->nullable()->after('recorded_by')->constrained('payouts')->nullOnDelete();
            $table->foreignId('client_system_id')->nullable()->after('payout_id')->constrained('client_systems')->nullOnDelete();
            // The payout due date this payment settled — lets "undo" put it back.
            $table->date('covered_due_date')->nullable()->after('client_system_id');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payout_id');
            $table->dropConstrainedForeignId('client_system_id');
            $table->dropColumn('covered_due_date');
        });
        Schema::dropIfExists('payouts');
    }
};
