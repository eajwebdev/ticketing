<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A system EAJ manages for a client: what they pay, how often, when it's due,
        // and the login we use to access it (encrypted at rest).
        Schema::create('client_systems', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('system_type_id')->constrained('system_types')->restrictOnDelete();
            $table->string('label')->nullable(); // e.g. "Main branch"
            $table->decimal('amount', 12, 2);
            $table->string('billing_cycle', 20); // monthly|quarterly|semiannual|yearly
            $table->date('next_due_date');
            $table->unsignedTinyInteger('billing_anchor_day'); // keeps due dates on the same day of the month
            $table->string('status', 20)->default('active'); // active|paused|cancelled
            $table->string('login_url')->nullable();
            $table->text('username')->nullable(); // encrypted
            $table->text('password')->nullable(); // encrypted
            $table->text('notes')->nullable();
            $table->date('last_reminded_on')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'next_due_date']);
        });

        // Every "mark as paid" is recorded here — this is EAJ's sales ledger.
        Schema::create('system_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_system_id')->constrained('client_systems')->cascadeOnDelete();
            // Denormalised so sales reports survive renames and stay fast.
            $table->foreignId('client_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('system_type_id')->constrained('system_types')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->date('paid_at');
            $table->date('covered_due_date'); // the due date this payment settled
            $table->date('next_due_date');    // what the due date moved to
            $table->string('method', 30)->default('cash');
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('paid_at');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('can_view_credentials')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('can_view_credentials');
        });
        Schema::dropIfExists('system_payments');
        Schema::dropIfExists('client_systems');
    }
};
