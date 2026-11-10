<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Which of the client's systems the ticket is about (a client can have several,
        // even two of the same type, e.g. two branches). system_type_id is kept for reports.
        Schema::table('tickets', function (Blueprint $table) {
            $table->foreignId('client_system_id')->nullable()->after('system_type_id')
                ->constrained('client_systems')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_system_id');
        });
    }
};
