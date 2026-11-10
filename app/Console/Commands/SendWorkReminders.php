<?php

namespace App\Console\Commands;

use App\Models\Lead;
use App\Models\Task;
use App\Notifications\WorkNotification;
use App\Support\Notify;
use Illuminate\Console\Command;

class SendWorkReminders extends Command
{
    protected $signature = 'work:remind';

    protected $description = 'Remind assignees about tasks due today/overdue and lead owners about follow-ups (once a day each).';

    public function handle(): int
    {
        $today = today();
        $notYetToday = fn ($q) => $q->whereNull('last_reminded_on')->orWhereDate('last_reminded_on', '<', $today);

        $tasks = Task::with('assignee')
            ->where('status', '!=', 'done')->whereNotNull('assignee_id')
            ->whereDate('due_date', '<=', $today)
            ->where($notYetToday)->get();

        foreach ($tasks as $task) {
            $late = (int) $task->due_date->diffInDays($today);
            $msg = $late > 0
                ? "Task overdue by {$late} ".str('day')->plural($late).": {$task->title}"
                : "Task due today: {$task->title}";
            Notify::safely([$task->assignee], new WorkNotification('task_due', $msg, "/app/tasks?task={$task->id}", ['task_id' => $task->id]));
            $task->forceFill(['last_reminded_on' => $today])->saveQuietly();
        }

        $leads = Lead::with('owner')
            ->whereIn('stage', Lead::OPEN_STAGES)->whereNotNull('owner_id')
            ->whereDate('next_follow_up', '<=', $today)
            ->where($notYetToday)->get();

        foreach ($leads as $lead) {
            Notify::safely([$lead->owner], new WorkNotification(
                'lead_follow_up',
                "Follow up with {$lead->business_name}".($lead->contact_person ? " ({$lead->contact_person})" : ''),
                "/app/leads?lead={$lead->id}",
                ['lead_id' => $lead->id],
            ));
            $lead->forceFill(['last_reminded_on' => $today])->saveQuietly();
        }

        $this->info("Reminded {$tasks->count()} task(s) and {$leads->count()} lead follow-up(s).");

        return self::SUCCESS;
    }
}
