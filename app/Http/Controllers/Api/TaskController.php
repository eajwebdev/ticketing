<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\TaskResource;
use App\Models\ClientSystem;
use App\Models\Task;
use App\Models\User;
use App\Notifications\WorkNotification;
use App\Support\Notify;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    private const RELATIONS = ['assignee', 'creator', 'client', 'clientSystem.systemType', 'ticket'];

    public function index(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isTeam(), 403);

        $query = Task::with(self::RELATIONS)->orderBy('position')->orderByDesc('id');

        match ($request->input('assignee')) {
            null, '', 'all' => null,
            'me' => $query->where('assignee_id', $user->id),
            'unassigned' => $query->whereNull('assignee_id'),
            default => $query->where('assignee_id', $request->integer('assignee')),
        };
        foreach (['priority', 'type', 'status'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, $request->input($f));
            }
        }
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }
        if ($request->filled('ticket_id')) {
            $query->where('ticket_id', $request->integer('ticket_id'));
        }
        if ($request->boolean('overdue')) {
            $query->where('status', '!=', 'done')->whereDate('due_date', '<', today());
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('title', 'like', "%$s%")->orWhere('description', 'like', "%$s%"));
        }
        // Keep the board light: work finished more than 30 days ago drops off unless asked for.
        if (! $request->boolean('include_old_done')) {
            $query->where(fn ($q) => $q->where('status', '!=', 'done')->orWhere('completed_at', '>=', now()->subDays(30)));
        }

        $open = fn () => Task::where('status', '!=', 'done');

        return TaskResource::collection($query->limit(500)->get())->additional([
            'summary' => [
                'mine_open' => $open()->where('assignee_id', $user->id)->count(),
                'mine_overdue' => $open()->where('assignee_id', $user->id)->whereDate('due_date', '<', today())->count(),
                'open' => $open()->count(),
                'overdue' => $open()->whereDate('due_date', '<', today())->count(),
                'done_this_week' => Task::where('status', 'done')->where('completed_at', '>=', now()->startOfWeek())->count(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->isTeam(), 403);
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;
        // New cards go to the top of their column.
        $data['position'] = (int) Task::where('status', $data['status'] ?? 'todo')->min('position') - 1;

        $task = Task::create($data);
        $this->notifyAssignee($task, $request->user());

        return (new TaskResource($task->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    public function update(Request $request, Task $task)
    {
        abort_unless($task->canBeEditedBy($request->user()), 403, 'Only the creator, the assignee or a manager can change this task.');
        $before = $task->assignee_id;

        $task->update($this->validated($request, $task));
        if ($task->assignee_id && $task->assignee_id !== $before) {
            $this->notifyAssignee($task, $request->user());
        }

        return new TaskResource($task->fresh(self::RELATIONS));
    }

    /** Drag & drop: put the task in a column and save that column's new order. */
    public function move(Request $request, Task $task)
    {
        abort_unless($task->canBeEditedBy($request->user()), 403, 'Only the creator, the assignee or a manager can move this task.');
        $data = $request->validate([
            'status' => ['required', Rule::in(Task::STATUSES)],
            'ordered_ids' => ['sometimes', 'array'],
            'ordered_ids.*' => ['integer'],
        ]);

        DB::transaction(function () use ($task, $data) {
            $task->update(['status' => $data['status']]);
            foreach (array_values($data['ordered_ids'] ?? []) as $i => $id) {
                Task::whereKey($id)->where('status', $data['status'])->update(['position' => $i]);
            }
        });

        return new TaskResource($task->fresh(self::RELATIONS));
    }

    public function destroy(Request $request, Task $task)
    {
        $user = $request->user();
        abort_unless($user->hasPermission(Permissions::TASKS_MANAGE) || $task->created_by === $user->id, 403,
            'Only the creator or a manager can delete this task.');
        $task->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?Task $task = null): array
    {
        $data = $request->validate([
            'title' => [$task ? 'sometimes' : 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'status' => ['sometimes', Rule::in(Task::STATUSES)],
            'priority' => ['sometimes', Rule::in(Task::PRIORITIES)],
            'type' => ['sometimes', Rule::in(Task::TYPES)],
            'assignee_id' => ['sometimes', 'nullable', Rule::exists('users', 'id')->whereIn('role', Role::teamValues())],
            'client_id' => ['sometimes', 'nullable', Rule::exists('users', 'id')->where('role', Role::Customer->value)],
            'client_system_id' => ['sometimes', 'nullable', 'exists:client_systems,id'],
            'ticket_id' => ['sometimes', 'nullable', 'exists:tickets,id'],
            'due_date' => ['sometimes', 'nullable', 'date'],
        ]);

        // A linked system implies its client.
        if (! empty($data['client_system_id'])) {
            $data['client_id'] = ClientSystem::find($data['client_system_id'])->client_id;
        }

        return $data;
    }

    private function notifyAssignee(Task $task, User $actor): void
    {
        if (! $task->assignee_id || $task->assignee_id === $actor->id) {
            return;
        }
        Notify::safely([$task->assignee], new WorkNotification(
            'task_assigned',
            "{$actor->name} assigned you a task: {$task->title}",
            "/app/tasks?task={$task->id}",
            ['task_id' => $task->id],
        ));
    }
}
