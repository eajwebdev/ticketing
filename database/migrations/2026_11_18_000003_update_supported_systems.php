<?php

use App\Support\DefaultSystems;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Brings the system list on existing servers in line with DefaultSystems:
 * renames old entries, merges duplicates (moving their tickets, client systems,
 * payments and leads), and adds the systems that are missing.
 * Systems an admin added that aren't in the list are left alone.
 */
return new class extends Migration
{
    private const REFERENCING_TABLES = ['tickets', 'client_systems', 'system_payments', 'leads'];

    public function up(): void
    {
        $now = now();

        DB::transaction(function () use ($now) {
            foreach (DefaultSystems::renamed() as $old => $new) {
                $oldRow = DB::table('system_types')->where('name', $old)->first();
                if (! $oldRow) {
                    continue;
                }
                $target = DB::table('system_types')->where('name', $new)->first();
                if (! $target) {
                    DB::table('system_types')->where('id', $oldRow->id)->update(['name' => $new, 'updated_at' => $now]);
                    continue;
                }
                // Both exist: move everything onto the new one, then drop the old row.
                foreach (self::REFERENCING_TABLES as $table) {
                    DB::table($table)->where('system_type_id', $oldRow->id)->update(['system_type_id' => $target->id]);
                }
                DB::table('system_types')->where('id', $oldRow->id)->delete();
            }

            foreach (DefaultSystems::all() as $i => $s) {
                $values = ['description' => $s['description'], 'icon' => $s['icon'], 'sort_order' => $i + 1, 'updated_at' => $now];
                $existing = DB::table('system_types')->where('name', $s['name'])->first();
                $existing
                    ? DB::table('system_types')->where('id', $existing->id)->update($values)
                    : DB::table('system_types')->insert([...$values, 'name' => $s['name'], 'is_active' => true, 'created_at' => $now]);
            }
        });
    }

    public function down(): void
    {
        // Data-only update; nothing to undo structurally.
    }
};
