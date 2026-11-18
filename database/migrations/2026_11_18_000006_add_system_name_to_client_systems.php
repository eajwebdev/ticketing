<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The exact name the client knows their system by (e.g. "Juan's LaundryPro"),
 * separate from the system type (Laundry Management System) and the branch label.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_systems', function (Blueprint $table) {
            $table->string('system_name')->nullable()->after('system_type_id');
        });
    }

    public function down(): void
    {
        Schema::table('client_systems', function (Blueprint $table) {
            $table->dropColumn('system_name');
        });
    }
};
