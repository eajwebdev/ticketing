<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['customer', 'agent', 'admin'])->default('customer')->after('email');

            // Client fields
            $table->string('store_name')->nullable()->after('role');
            $table->string('business_type')->nullable()->after('store_name');
            $table->string('address')->nullable()->after('business_type');
            $table->string('contact_person')->nullable()->after('address');
            $table->string('phone')->nullable()->after('contact_person');
            $table->text('notes')->nullable()->after('phone');

            // Team member fields
            $table->string('position')->nullable()->after('notes');
            $table->string('department')->nullable()->after('position');
            $table->text('bio')->nullable()->after('department');

            $table->string('avatar_path')->nullable()->after('bio');
            $table->boolean('is_active')->default(true)->after('avatar_path');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'role', 'store_name', 'business_type', 'address', 'contact_person',
                'phone', 'notes', 'position', 'department', 'bio', 'avatar_path', 'is_active',
            ]);
        });
    }
};
