<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A client can own several businesses/stores. `business_names` holds the full
 * list; `store_name` stays as the primary (first) name so every screen that
 * shows it keeps working. The User model keeps the two in sync.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('business_names')->nullable()->after('store_name');
        });

        DB::table('users')->whereNotNull('store_name')->where('store_name', '!=', '')
            ->orderBy('id')->each(function ($u) {
                DB::table('users')->where('id', $u->id)
                    ->update(['business_names' => json_encode([trim($u->store_name)], JSON_UNESCAPED_UNICODE)]);
            });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('business_names');
        });
    }
};
