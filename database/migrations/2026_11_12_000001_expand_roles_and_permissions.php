<?php

use App\Enums\Role;
use App\Support\Permissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // enum('customer','agent','admin') -> free string so roles can grow.
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 30)->default('customer')->change();
            // null = use the role's defaults; an array = custom set chosen by an admin.
            $table->json('permissions')->nullable()->after('role');
        });

        // Old "agent" accounts become Support. Keep anyone who had login access.
        $support = Role::Support->defaultPermissions();
        DB::table('users')->where('role', 'agent')->orderBy('id')->each(function ($u) use ($support) {
            DB::table('users')->where('id', $u->id)->update([
                'role' => 'support',
                'permissions' => $u->can_view_credentials
                    ? json_encode(array_values(array_unique([...$support, Permissions::CREDENTIALS])))
                    : null,
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('can_view_credentials');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('can_view_credentials')->default(false);
        });
        DB::table('users')->whereNotIn('role', ['customer', 'admin'])->update(['role' => 'agent']);
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('permissions');
            $table->enum('role', ['customer', 'agent', 'admin'])->default('customer')->change();
        });
    }
};
