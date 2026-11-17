<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** A client can run several kinds of business: business_type (string) -> business_types (JSON list). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('business_types')->nullable()->after('store_name');
        });

        DB::table('users')->whereNotNull('business_type')->where('business_type', '!=', '')
            ->orderBy('id')->each(function ($u) {
                DB::table('users')->where('id', $u->id)
                    ->update(['business_types' => json_encode([trim($u->business_type)], JSON_UNESCAPED_UNICODE)]);
            });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('business_type');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('business_type')->nullable()->after('store_name');
        });

        DB::table('users')->whereNotNull('business_types')->orderBy('id')->each(function ($u) {
            $types = json_decode($u->business_types, true) ?: [];
            DB::table('users')->where('id', $u->id)
                ->update(['business_type' => $types ? mb_substr(implode(', ', $types), 0, 255) : null]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('business_types');
        });
    }
};
