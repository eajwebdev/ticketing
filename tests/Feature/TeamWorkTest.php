<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Lead;
use App\Models\Task;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeamWorkTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        config(['broadcasting.default' => 'null']);
        Carbon::setTestNow('2026-03-10 09:00:00');
        $this->owner = User::factory()->create(['role' => Role::Admin, 'approval_status' => 'approved']);
    }

    private function member(Role $role, array $attrs = []): User
    {
        return User::factory()->create(['role' => $role, 'approval_status' => 'approved', ...$attrs]);
    }

    // ---------------- Users & roles ----------------

    public function test_admin_creates_accounts_for_every_role(): void
    {
        Sanctum::actingAs($this->owner);

        $this->getJson('/api/v1/admin/roles')->assertOk()->assertJsonCount(count(Role::cases()), 'roles');

        foreach (Role::cases() as $i => $role) {
            $res = $this->postJson('/api/v1/admin/users', [
                'name' => "Person $i", 'email' => "p$i@eaj.test", 'role' => $role->value, 'position' => 'Staff',
            ])->assertCreated();
            $this->assertNotEmpty($res->json('temporary_password'));
            $this->assertSame($role->label(), $res->json('user.data.role_label') ?? $res->json('user.role_label'));
        }

        // New accounts can sign in with the temp password.
        $pw = $this->postJson('/api/v1/admin/users', ['name' => 'Dev', 'email' => 'dev@eaj.test', 'role' => 'developer'])->json('temporary_password');
        $this->postJson('/api/v1/auth/login', ['email' => 'dev@eaj.test', 'password' => $pw])
            ->assertOk()->assertJsonPath('user.permissions', ['tickets.handle', 'systems.view']);
    }

    public function test_role_defaults_and_custom_permissions(): void
    {
        $marketing = $this->member(Role::Marketing);
        $this->assertTrue($marketing->hasPermission('leads.manage'));
        $this->assertFalse($marketing->hasPermission('billing.manage'));

        Sanctum::actingAs($this->owner);
        $this->patchJson("/api/v1/admin/users/{$marketing->id}", ['permissions' => ['leads.manage', 'clients.manage', 'analytics.view']])
            ->assertOk()->assertJsonPath('data.has_custom_permissions', true);
        $this->assertTrue($marketing->fresh()->hasPermission('analytics.view'));

        // Changing role without a custom set resets to the new role's defaults.
        $this->patchJson("/api/v1/admin/users/{$marketing->id}", ['role' => 'finance'])->assertOk();
        $this->assertEqualsCanonicalizing(Role::Finance->defaultPermissions(), $marketing->fresh()->permissionList());
    }

    public function test_only_settings_managers_manage_users_and_cannot_lock_themselves_out(): void
    {
        $dev = $this->member(Role::Developer);
        Sanctum::actingAs($dev);
        $this->getJson('/api/v1/admin/users')->assertForbidden();
        $this->postJson('/api/v1/admin/users', ['name' => 'x', 'email' => 'x@x.x', 'role' => 'admin'])->assertForbidden();

        Sanctum::actingAs($this->owner);
        $this->patchJson("/api/v1/admin/users/{$this->owner->id}", ['role' => 'developer', 'is_active' => false])->assertOk();
        $this->assertTrue($this->owner->fresh()->isAdmin());
        $this->assertTrue($this->owner->fresh()->is_active);

        $this->postJson("/api/v1/admin/users/{$dev->id}/reset-password")->assertOk()->assertJsonStructure(['temporary_password']);
    }

    public function test_permissions_gate_modules(): void
    {
        $finance = $this->member(Role::Finance);
        $designer = $this->member(Role::Designer);

        Sanctum::actingAs($finance);
        $this->getJson('/api/v1/admin/sales')->assertOk();
        $this->getJson('/api/v1/admin/billing/overview')->assertOk();
        $this->getJson('/api/v1/leads')->assertForbidden();
        $this->getJson('/api/v1/admin/analytics')->assertOk();

        Sanctum::actingAs($designer);
        $this->getJson('/api/v1/admin/sales')->assertForbidden();
        $this->getJson('/api/v1/admin/client-systems')->assertForbidden();
        $this->getJson('/api/v1/tasks')->assertOk();
    }

    public function test_team_without_ticket_permission_only_sees_tickets_they_are_on(): void
    {
        $client = $this->member(Role::Customer);
        $designer = $this->member(Role::Designer);
        $mine = Ticket::create(['ticket_number' => 'T-1', 'customer_id' => $client->id, 'subject' => 'Logo', 'description' => 'x', 'status' => 'open']);
        $other = Ticket::create(['ticket_number' => 'T-2', 'customer_id' => $client->id, 'subject' => 'Bug', 'description' => 'x', 'status' => 'open']);
        $mine->assignees()->attach($designer->id, ['is_primary' => false]);

        Sanctum::actingAs($designer);
        $ids = collect($this->getJson('/api/v1/tickets')->assertOk()->json('data'))->pluck('id');
        $this->assertEquals([$mine->id], $ids->all());
        $this->getJson("/api/v1/tickets/{$other->id}")->assertForbidden();
        $this->postJson("/api/v1/tickets/{$other->id}/accept")->assertForbidden();
    }

    // ---------------- Tasks ----------------

    public function test_tasks_board_flow(): void
    {
        $dev = $this->member(Role::Developer);
        $qa = $this->member(Role::Qa);
        Sanctum::actingAs($this->owner);

        $id = $this->postJson('/api/v1/tasks', [
            'title' => 'Fix receipt printing', 'priority' => 'urgent', 'type' => 'bug',
            'assignee_id' => $dev->id, 'due_date' => '2026-03-12',
        ])->assertCreated()->assertJsonPath('data.assignee.id', $dev->id)->json('data.id');

        $this->assertSame('task_assigned', $dev->notifications()->first()->data['type']);

        // The assignee moves it along; completed_at is stamped on done.
        Sanctum::actingAs($dev);
        $this->postJson("/api/v1/tasks/{$id}/move", ['status' => 'done', 'ordered_ids' => [$id]])->assertOk()
            ->assertJsonPath('data.status', 'done');
        $this->assertNotNull(Task::find($id)->completed_at);
        $this->getJson('/api/v1/tasks?assignee=me')->assertOk()->assertJsonPath('summary.done_this_week', 1);

        // Someone else's task: QA can't edit or delete it.
        Sanctum::actingAs($qa);
        $this->patchJson("/api/v1/tasks/{$id}", ['title' => 'nope'])->assertForbidden();
        $this->deleteJson("/api/v1/tasks/{$id}")->assertForbidden();

        // Clients have no access to tasks.
        Sanctum::actingAs($this->member(Role::Customer));
        $this->getJson('/api/v1/tasks')->assertForbidden();
    }

    public function test_overdue_tasks_and_lead_follow_ups_send_daily_reminders(): void
    {
        $dev = $this->member(Role::Developer);
        $mkt = $this->member(Role::Marketing);
        Task::create(['title' => 'Late', 'assignee_id' => $dev->id, 'due_date' => '2026-03-08']);
        Task::create(['title' => 'Later', 'assignee_id' => $dev->id, 'due_date' => '2026-03-20']);
        Task::create(['title' => 'Done', 'assignee_id' => $dev->id, 'due_date' => '2026-03-01', 'status' => 'done']);
        $cafe = Lead::create(['business_name' => 'Cafe Uno', 'owner_id' => $mkt->id, 'next_follow_up' => '2026-03-10']);
        Lead::create(['business_name' => 'Lost Co', 'owner_id' => $mkt->id, 'next_follow_up' => '2026-03-01', 'stage' => 'lost']);

        $this->artisan('work:remind')->assertSuccessful();
        $this->artisan('work:remind'); // same day: no repeats

        $this->assertSame(1, $dev->notifications()->count());
        $this->assertStringContainsString('overdue by 2 days', $dev->notifications()->first()->data['message']);
        $this->assertSame(1, $mkt->notifications()->count());
        $this->assertSame("/app/leads?lead={$cafe->id}", $mkt->notifications()->first()->data['link']);
    }

    // ---------------- Leads ----------------

    public function test_lead_pipeline_and_convert_to_client(): void
    {
        $mkt = $this->member(Role::Marketing);
        Sanctum::actingAs($mkt);

        $id = $this->postJson('/api/v1/leads', [
            'business_name' => 'Sunshine Laundry', 'contact_person' => 'Ana', 'phone' => '0917', 'source' => 'facebook',
            'estimated_value' => 15000, 'next_follow_up' => '2026-03-11',
        ])->assertCreated()->assertJsonPath('data.owner.id', $mkt->id)->json('data.id');

        $this->postJson("/api/v1/leads/{$id}/move", ['stage' => 'demo'])->assertOk()->assertJsonPath('data.stage', 'demo');
        $this->getJson('/api/v1/leads')->assertOk()
            ->assertJsonPath('summary.open', 1)->assertJsonPath('summary.pipeline_value', 15000);

        $res = $this->postJson("/api/v1/leads/{$id}/convert", ['name' => 'Ana Cruz', 'email' => 'ana@sunshine.ph'])->assertCreated();
        $this->assertNotEmpty($res->json('temporary_password'));
        $client = User::where('email', 'ana@sunshine.ph')->first();
        $this->assertSame(Role::Customer, $client->role);
        $this->assertSame('Sunshine Laundry', $client->store_name);
        $this->assertSame('won', Lead::find($id)->stage);
        $this->postJson("/api/v1/leads/{$id}/convert", ['name' => 'x', 'email' => 'y@y.y'])->assertStatus(422);

        Sanctum::actingAs($this->member(Role::Developer));
        $this->getJson('/api/v1/leads')->assertForbidden();
    }
}
