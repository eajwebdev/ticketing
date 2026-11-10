<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Internal work items for the team (dev work, design, QA, marketing jobs…).
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('todo');      // todo|in_progress|review|done
            $table->string('priority', 10)->default('medium');  // low|medium|high|urgent
            $table->string('type', 20)->default('feature');     // feature|bug|improvement|design|marketing|other
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('client_system_id')->nullable()->constrained('client_systems')->nullOnDelete();
            $table->foreignId('ticket_id')->nullable()->constrained('tickets')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->date('last_reminded_on')->nullable();
            $table->integer('position')->default(0);
            $table->timestamps();

            $table->index(['status', 'position']);
            $table->index(['assignee_id', 'status']);
        });

        // Prospects for Marketing, from first contact to signed client.
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('business_name');
            $table->string('contact_person')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('business_type')->nullable();
            $table->string('source', 20)->default('other');     // facebook|referral|website|walk_in|event|other
            $table->foreignId('system_type_id')->nullable()->constrained('system_types')->nullOnDelete();
            $table->decimal('estimated_value', 12, 2)->nullable();
            $table->string('stage', 20)->default('new');        // new|contacted|demo|proposal|won|lost
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('next_follow_up')->nullable();
            $table->date('last_reminded_on')->nullable();
            $table->text('notes')->nullable();
            $table->string('lost_reason')->nullable();
            $table->foreignId('converted_client_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('converted_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('stage');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
        Schema::dropIfExists('tasks');
    }
};
