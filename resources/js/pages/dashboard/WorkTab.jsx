import { KanbanSquare, AlarmClock, CalendarClock, CheckCheck, ListTodo, Target, BellRing, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { peso, shortDate, localDate } from '@/lib/format';
import { Kpi, KpiGrid, Panel, PanelLink, Row, AllClear } from './widgets';

const STATUS = {
  todo: { label: 'To do', color: '#8A96B8' },
  in_progress: { label: 'In progress', color: '#3B82F6' },
  review: { label: 'Review', color: '#F59E0B' },
  done: { label: 'Done', color: '#22C55E' },
};
const PRIORITY = { urgent: '#E91E4F', high: '#F59E0B', medium: '#3B82F6', low: '#8A96B8' };
const STAGE = {
  new: { label: 'New', color: '#8A96B8' },
  contacted: { label: 'Contacted', color: '#3B82F6' },
  demo: { label: 'Demo', color: '#8B5CF6' },
  proposal: { label: 'Proposal', color: '#F59E0B' },
  won: { label: 'Won', color: '#22C55E' },
  lost: { label: 'Lost', color: '#E91E4F' },
};

/** Tasks (yours, or the whole team's for managers) and the sales pipeline. */
export default function WorkTab({ data }) {
  const t = data.work.tasks;
  const leads = data.work.leads;
  const mine = data.work.scope === 'mine';
  const totalTasks = t.by_status.reduce((n, s) => n + s.value, 0);

  return (
    <div className="space-y-5">
      <KpiGrid>
        <Kpi index={0} icon={ListTodo} label={mine ? 'My open tasks' : 'Open tasks (team)'} value={t.open} accent="#8B5CF6" to="/app/tasks" />
        <Kpi index={1} icon={AlarmClock} label="Overdue" value={t.overdue} accent="#E91E4F"
          tone={t.overdue ? 'danger' : 'success'} sub={t.overdue ? 'Past their due date' : 'Nothing overdue'} to="/app/tasks" />
        <Kpi index={2} icon={CalendarClock} label="Due today" value={t.due_today} accent="#F59E0B" tone={t.due_today ? 'warning' : 'default'} />
        <Kpi index={3} icon={CheckCheck} label="Done this week" value={t.done_this_week} accent="#22C55E" />
      </KpiGrid>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title={mine ? 'My next tasks' : 'Next tasks (team)'} icon={KanbanSquare}
          subtitle="Soonest due first." action={<PanelLink to="/app/tasks">Task board</PanelLink>}>
          {t.upcoming.length ? (
            <div className="space-y-2">
              {t.upcoming.map((task) => (
                <Row key={task.id} to={`/app/tasks?task=${task.id}`} dot={PRIORITY[task.priority]}
                  title={task.title}
                  subtitle={[STATUS[task.status]?.label, !mine && (task.assignee ?? 'Unassigned'), task.client].filter(Boolean).join(' · ')}
                  rightSub={task.due_date ? (task.is_overdue ? `Overdue · ${shortDate(localDate(task.due_date))}` : `Due ${shortDate(localDate(task.due_date))}`) : 'No due date'}
                  rightTone={task.is_overdue ? 'font-semibold text-crimson-soft' : undefined} />
              ))}
            </div>
          ) : <AllClear>No open tasks{mine ? ' assigned to you' : ''}.</AllClear>}
        </Panel>

        <Panel title="Board status" icon={Filter} subtitle={`${totalTasks} task${totalTasks === 1 ? '' : 's'}${mine ? ' assigned to you' : ''}`}>
          {totalTasks ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-navy-700" role="img"
                aria-label={t.by_status.map((s) => `${STATUS[s.status]?.label}: ${s.value}`).join(', ')}>
                {t.by_status.filter((s) => s.value).map((s) => (
                  <motion.div key={s.status} style={{ background: STATUS[s.status]?.color }}
                    initial={false} animate={{ width: `${(s.value / totalTasks) * 100}%` }} transition={{ duration: 0.5 }} />
                ))}
              </div>
              <ul className="mt-4 space-y-2">
                {t.by_status.map((s) => (
                  <li key={s.status} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[s.status]?.color }} />{STATUS[s.status]?.label ?? s.status}
                    </span>
                    <span className="font-semibold tabular-nums text-white">{s.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>}
        </Panel>
      </div>

      {leads && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel className="lg:col-span-2" title="Sales pipeline" icon={Target}
            subtitle={`${peso(leads.pipeline_value)} setup${leads.pipeline_monthly > 0 ? ` + ${peso(leads.pipeline_monthly)}/mo` : ''} in ${leads.open} open lead${leads.open === 1 ? '' : 's'} · ${leads.won_in_range ?? leads.won_this_month} won · ${data.range?.label ?? 'this month'}`}
            action={<PanelLink to="/app/leads">Leads</PanelLink>}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {leads.stages.map((st) => (
                <div key={st.stage} className="rounded-xl bg-navy-800/50 p-3 text-center">
                  <div className="mx-auto mb-1.5 h-1 w-8 rounded-full" style={{ background: STAGE[st.stage]?.color }} />
                  <div className="text-xl font-bold tabular-nums text-white">{st.count}</div>
                  <div className="text-[11px] text-muted-foreground">{STAGE[st.stage]?.label ?? st.stage}</div>
                  {st.value > 0 && <div className="mt-0.5 truncate text-[10px] text-muted-foreground/80">{peso(st.value)}</div>}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Follow-ups" icon={BellRing} subtitle="Overdue and due in the next 2 days.">
            {leads.follow_ups.length ? (
              <div className="space-y-2">
                {leads.follow_ups.map((l) => (
                  <Row key={l.id} to="/app/leads" dot={STAGE[l.stage]?.color} title={l.business_name}
                    subtitle={[STAGE[l.stage]?.label, l.owner].filter(Boolean).join(' · ')}
                    rightSub={l.is_overdue ? `Overdue · ${shortDate(localDate(l.next_follow_up))}` : shortDate(localDate(l.next_follow_up))}
                    rightTone={l.is_overdue ? 'font-semibold text-crimson-soft' : undefined} />
                ))}
              </div>
            ) : <AllClear>No follow-ups due.</AllClear>}
          </Panel>
        </div>
      )}
    </div>
  );
}
