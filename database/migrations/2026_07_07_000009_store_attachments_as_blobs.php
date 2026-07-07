<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ticket_attachments', function (Blueprint $table) {
            // Unguessable token so <img src> can load the file without auth headers.
            $table->string('token', 64)->nullable()->after('path');
            $table->string('path')->nullable()->change(); // legacy disk files only
        });

        // Compressed file bytes live in the row (MEDIUMBLOB = up to 16 MB).
        DB::statement('ALTER TABLE ticket_attachments ADD `data` MEDIUMBLOB NULL AFTER `token`');
    }

    public function down(): void
    {
        Schema::table('ticket_attachments', function (Blueprint $table) {
            $table->dropColumn(['token', 'data']);
        });
    }
};
