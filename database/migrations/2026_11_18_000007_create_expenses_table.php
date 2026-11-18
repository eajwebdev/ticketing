<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Business expenses — paired with system payments (revenue) to show profit on the dashboard. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->date('spent_on')->index();
            $table->string('category', 100)->index();
            $table->string('description');
            $table->decimal('amount', 12, 2);
            $table->string('payee')->nullable();
            $table->string('method', 30)->nullable();
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
