import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Ticket, MessagesSquare, CheckCircle2, Eye, ShieldCheck, Bell, ImageIcon,
  LogIn, ChevronDown, Timer, Layers, UserCheck, Send,
} from 'lucide-react';
import { systemIcon } from '@/lib/systemIcons';
import api from '@/lib/api';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { GoogleMark } from '@/components/auth/GoogleSignInButton';
import { cn } from '@/lib/utils';

// Shown only if the API can't be reached (keeps the page looking right).
const FALLBACK_SYSTEMS = [
  { name: 'Laundry Management System', icon: 'WashingMachine', description: 'Job orders, claim tags, pickup & delivery, and daily sales for laundry shops.' },
  { name: 'Grocery POS', icon: 'ShoppingCart', description: 'Fast barcode checkout, stock levels and sales reports for groceries and mini-marts.' },
  { name: 'Cafe & Restaurant POS', icon: 'UtensilsCrossed', description: 'Table and take-out orders, kitchen tickets, menu and ingredient inventory.' },
  { name: 'Inventory Management System', icon: 'Boxes', description: 'Stock in/out, suppliers, purchase orders and multi-branch inventory tracking.' },
  { name: 'Pharmacy Management System', icon: 'Pill', description: 'Dispensing, expiry and batch tracking, senior/PWD discounts and pharmacy sales.' },
  { name: 'Company Website', icon: 'Globe', description: 'Professional websites for your business — design, hosting, updates and support.' },
  { name: 'Hardware Store Management System', icon: 'Hammer', description: 'POS and inventory for hardware stores — items by unit, pricing, suppliers and credit.' },
  { name: 'Construction ERP', icon: 'HardHat', description: 'Projects, materials, manpower, costing and progress billing for contractors.' },
  { name: 'Human Resource Management System', icon: 'Users', description: 'Employee records, attendance, leave and payroll in one place.' },
  { name: 'Water Refilling Station System', icon: 'Droplets', description: 'Refill and delivery orders, container tracking, customers and daily sales.' },
  { name: 'Condo & Resort Management System', icon: 'Hotel', description: 'Bookings, units and rooms, tenant billing, dues and front-desk operations.' },
];

const FALLBACK_URGENCY = [
  { name: 'Critical', color: '#E91E4F', sla_hours: 4 },
  { name: 'High', color: '#F59E0B', sla_hours: 24 },
  { name: 'Medium', color: '#3B82F6', sla_hours: 48 },
  { name: 'Low', color: '#8A96B8', sla_hours: 72 },
];

const URGENCY_HINT = {
  critical: 'Business stopped — can’t sell, can’t open',
  high: 'A key feature is broken',
  medium: 'Something’s wrong but you can work around it',
  low: 'Questions, small fixes and requests',
};

const INDUSTRIES = [
  'Laundry shops', 'Groceries & mini-marts', 'Cafes & restaurants', 'Pharmacies', 'Hardware stores',
  'Contractors', 'Water refilling stations', 'Condos & resorts', 'Retail & wholesale', 'Growing companies',
];

const NAV = [
  { href: '#systems', label: 'Systems' },
  { href: '#how', label: 'How it works' },
  { href: '#response', label: 'Response times' },
  { href: '#faq', label: 'FAQ' },
];

const hoursLabel = (h) => (h < 24 ? `${h} hour${h === 1 ? '' : 's'}` : `${Math.round(h / 24)} day${h / 24 === 1 ? '' : 's'}`);

function AnimatedNumber({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value == null) return;
    let raf;
    const start = performance.now();
    const dur = 1400;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      setDisplay(Math.floor(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null) return <span className="opacity-40">—</span>;
  return <>{display.toLocaleString()}{suffix}</>;
}

export default function Landing() {
  const [systemTypes, setSystemTypes] = useState([]);
  const [urgency, setUrgency] = useState([]);
  const [team, setTeam] = useState([]);
  const [live, setLive] = useState(null);

  useEffect(() => {
    api.get('/system-types').then((r) => setSystemTypes(r.data.data)).catch(() => {});
    api.get('/urgency-levels').then((r) => setUrgency(r.data.data)).catch(() => {});
    api.get('/team').then((r) => setTeam(r.data.data)).catch(() => {});
    api.get('/stats').then((r) => setLive(r.data)).catch(() => {});
  }, []);

  const systems = systemTypes.length ? systemTypes : FALLBACK_SYSTEMS;
  const levels = (urgency.length ? urgency : FALLBACK_URGENCY)
    .filter((u) => u.sla_hours)
    .sort((a, b) => a.sla_hours - b.sla_hours);

  // Real numbers from the stats endpoint (cached server-side).
  const avgMins = live?.avg_response_minutes;
  const responseStat = avgMins == null
    ? { value: null, suffix: '' }
    : avgMins < 60 ? { value: avgMins, suffix: 'm' } : { value: Math.round(avgMins / 60), suffix: 'h' };

  const stats = [
    { label: 'Tickets resolved', value: live?.tickets_resolved, suffix: '' },
    { label: 'Avg response time', ...responseStat },
    { label: 'Systems supported', value: live?.systems_supported ?? systems.length },
    { label: 'Client satisfaction', value: live?.satisfaction_percent, suffix: '%' },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-navy-600/40 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {NAV.map((n) => <a key={n.href} href={n.href} className="transition-colors hover:text-mist">{n.label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
            <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/register">Get started <ArrowRight /></Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="bg-grid absolute inset-0 opacity-60" />
          <div className="absolute left-[10%] top-10 h-80 w-80 animate-float rounded-full bg-crimson/20 blur-[110px]" />
          <div className="absolute right-[10%] top-40 h-80 w-80 animate-float rounded-full bg-navy-500/40 blur-[110px]" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div className="text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-crimson/30 bg-crimson/10 px-4 py-1.5 text-xs font-medium text-crimson-soft backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson-soft opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-crimson-soft" />
              </span>
              EAJ Client Support Center
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5 }}
              className="text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Your business runs on EAJ.{' '}
              <span className="grad-text-animated">We keep it running.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
              Something wrong with your POS, inventory, payroll or website? Open a ticket, chat directly with
              the developers who built your system, and follow every step until it’s fixed.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link to="/login"
                className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white px-6 text-sm font-semibold text-[#1f1f1f] shadow-lg transition hover:scale-[1.03] hover:bg-gray-100 sm:w-auto">
                <GoogleMark /> Continue with Google
              </Link>
              <Button asChild size="lg" className="btn-shine w-full sm:w-auto"><Link to="/login"><Ticket /> Submit a ticket</Link></Button>
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="mt-4 text-xs text-muted-foreground">
              Already an EAJ client? Sign in with the Google account or email you use with us.
            </motion.p>
          </div>

          <HeroTicketPreview />
        </div>

        {/* Stats band — real numbers */}
        <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="grad-border relative grid grid-cols-2 gap-4 rounded-2xl glass p-6 sm:grid-cols-4 sm:divide-x sm:divide-navy-600/50">
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center">
                <div className="text-3xl font-bold grad-text sm:text-4xl"><AnimatedNumber value={s.value} suffix={s.suffix} /></div>
                <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Systems we support */}
      <Section id="systems" eyebrow="What we support" title="Every system we build, we support"
        subtitle="Using any of these EAJ systems? Our team has you covered — from a quick question to a full fix.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((s, i) => {
            const Icon = systemIcon(s.icon);
            return (
              <motion.div key={s.id ?? s.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 6) * 0.05 }}
                className="hover-lift group flex items-start gap-4 rounded-2xl glass p-5 hover:border-crimson/40">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl grad-brand shadow-[0_0_20px_rgba(233,30,79,0.35)] transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-mist">{s.name}</h3>
                  {s.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.description}</p>}
                </div>
              </motion.div>
            );
          })}
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-12 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Trusted by businesses like yours</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {INDUSTRIES.map((name) => (
              <span key={name} className="rounded-full border border-navy-600/70 bg-navy-800/50 px-3.5 py-1.5 text-xs text-mist/90">{name}</span>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* How it works */}
      <Section id="how" eyebrow="How it works" title="From problem to fixed in four steps" subtitle="No phone tag, no lost messages — everything lives in one ticket.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: LogIn, title: 'Sign in', text: 'Continue with Google or your email. New accounts are approved by EAJ so only our clients get in.' },
            { icon: Ticket, title: 'Submit a ticket', text: 'Pick your system and branch, describe the problem, and set how urgent it is.' },
            { icon: MessagesSquare, title: 'Chat with a developer', text: 'A developer accepts your ticket and chats with you live — send screenshots and photos.' },
            { icon: CheckCircle2, title: 'Resolved & recorded', text: 'Once it’s fixed you’re notified, and the full history stays with the ticket.' },
          ].map((step, i) => (
            <motion.div key={step.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="relative rounded-2xl glass p-6">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-crimson/15 text-crimson-soft">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="absolute right-5 top-5 text-4xl font-bold text-navy-600/60">{i + 1}</div>
              <h3 className="font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Response targets — from the urgency levels admins configure */}
      <Section id="response" eyebrow="Response times" title="Urgent problems jump the line"
        subtitle="Every ticket gets a target resolution time based on how urgent it is — and we track how we do against it.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {levels.map((u, i) => (
            <motion.div key={u.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="relative overflow-hidden rounded-2xl glass p-6">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: u.color }} />
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: u.color, boxShadow: `0 0 12px ${u.color}` }} />
                <span className="text-sm font-semibold" style={{ color: u.color }}>{u.name}</span>
              </div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <Timer className="h-5 w-5 self-center text-muted-foreground" />
                <span className="text-3xl font-bold text-white">{hoursLabel(u.sla_hours)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">target resolution</p>
              {URGENCY_HINT[u.name.toLowerCase()] && (
                <p className="mt-3 border-t border-navy-600/60 pt-3 text-sm text-mist/85">{URGENCY_HINT[u.name.toLowerCase()]}</p>
              )}
            </motion.div>
          ))}
        </div>
      </Section>

      {/* What clients get */}
      <Section eyebrow="Why clients love it" title="Support you can actually see">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            { icon: Eye, title: 'Always know the status', text: 'Submitted, accepted, in progress, resolved — plus who’s working on it and the expected fix time.' },
            { icon: MessagesSquare, title: 'Talk to the builders', text: 'Chat with the developers behind your system, not a script. Replies show up instantly.' },
            { icon: ImageIcon, title: 'Show, don’t explain', text: 'Send screenshots or a photo of the error straight from your phone.' },
            { icon: Layers, title: 'All your branches', text: 'Have several systems or branches? Pick the exact one so the right fix goes to the right place.' },
            { icon: Bell, title: 'Never miss an update', text: 'Get notified when the team replies, sets an expected fix time, and resolves your ticket.' },
            { icon: ShieldCheck, title: 'Private & secure', text: 'Your tickets and conversations are visible only to you and the EAJ team.' },
          ].map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.08 }}
              className="rounded-2xl glass p-6">
              <f.icon className="h-7 w-7 text-crimson-soft" />
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Meet the team */}
      {team.length > 0 && (
        <Section eyebrow="The people" title="Meet your support team" subtitle="Real people behind every resolved ticket.">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {team.slice(0, 8).map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <Link to={`/team/${m.id}`} className="hover-lift block rounded-2xl glass p-5 text-center hover:border-crimson/40">
                  <UserAvatar user={m} className="mx-auto h-16 w-16" />
                  <h3 className="mt-3 font-semibold text-mist">{m.name}</h3>
                  <p className="text-xs text-crimson-soft">{m.position}</p>
                  <p className="text-[11px] text-muted-foreground">{m.department}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* FAQ */}
      <Section id="faq" eyebrow="FAQ" title="Questions clients ask">
        <div className="mx-auto max-w-3xl space-y-3">
          {[
            { q: 'How do I get an account?', a: 'Click “Continue with Google” (or register with your email). EAJ confirms you’re a client and approves your account — then you can sign in and submit tickets.' },
            { q: 'How fast will you fix my problem?', a: 'It depends on urgency — see the response times above. If your business can’t operate, mark the ticket Critical and it goes to the front of the line.' },
            { q: 'Can I send screenshots?', a: 'Yes. Attach photos or screenshots right in the ticket chat — it’s the fastest way to show us what’s wrong.' },
            { q: 'I have more than one branch or system. Which one do I pick?', a: 'When you submit a ticket you choose the exact system or branch it’s about, so the fix goes to the right place.' },
            { q: 'I forgot my password.', a: 'If you use Google, just sign in with Google. Otherwise contact the EAJ team and an admin will send you a new temporary password.' },
            { q: 'Can I request a new feature?', a: 'Absolutely — submit a ticket with the “Feature Request” category and tell us what you need.' },
          ].map((f) => <FaqItem key={f.q} {...f} />)}
        </div>
      </Section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl grad-brand p-10 text-center sm:p-16">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(40% 60% at 50% 0%, rgba(255,77,117,0.4), transparent 70%)' }} />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Need help with your system?</h2>
            <p className="mx-auto mt-3 max-w-xl text-mist/80">Sign in and open a ticket — the EAJ team is ready.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/login"
                className="inline-flex h-12 items-center gap-3 rounded-full bg-white px-6 text-sm font-semibold text-[#1f1f1f] shadow-lg transition hover:scale-[1.03] hover:bg-gray-100">
                <GoogleMark /> Continue with Google
              </Link>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <Link to="/login">Sign in with email</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy-600/40 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <Logo size="sm" />
          <nav className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
            {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-mist">{n.label}</a>)}
            <Link to="/login" className="hover:text-mist">Sign in</Link>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EAJ Systems</p>
        </div>
      </footer>
    </div>
  );
}

/** Illustration of a ticket in progress — shows clients what they'll get. */
function HeroTicketPreview() {
  const steps = [
    { icon: Send, label: 'Submitted', time: '9:02 AM', done: true },
    { icon: UserCheck, label: 'Accepted', time: '9:06 AM', done: true },
    { icon: MessagesSquare, label: 'In progress', time: 'now', active: true },
    { icon: CheckCircle2, label: 'Resolved', time: '', done: false },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 24, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
      className="relative mx-auto w-full max-w-md" aria-label="Example of a support ticket">
      <div className="absolute -inset-4 rounded-[2rem] bg-crimson/10 blur-2xl" />
      <div className="relative rounded-3xl glass-strong p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] text-muted-foreground">Ticket #1042 · Laundry Management System</div>
            <div className="mt-1 font-semibold text-white">Receipt printer not printing</div>
          </div>
          <span className="shrink-0 rounded-full bg-crimson/15 px-2.5 py-1 text-[11px] font-semibold text-crimson-soft">Critical</span>
        </div>

        {/* Progress */}
        <div className="mt-5 grid grid-cols-4 gap-1">
          {steps.map((s) => (
            <div key={s.label} className="text-center">
              <div className={cn('mx-auto grid h-8 w-8 place-items-center rounded-full border',
                s.done && 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
                s.active && 'border-crimson bg-crimson/20 text-crimson-soft animate-pulse',
                !s.done && !s.active && 'border-navy-600 text-muted-foreground')}>
                <s.icon className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1.5 text-[10px] font-medium text-mist">{s.label}</div>
              <div className="text-[9px] text-muted-foreground">{s.time || '—'}</div>
            </div>
          ))}
        </div>

        {/* Chat */}
        <div className="mt-5 space-y-2.5 rounded-2xl bg-navy-900/50 p-3">
          <Bubble side="left" who="You">Our receipt printer stopped after the update 😥</Bubble>
          <Bubble side="right" who="EAJ Developer">On it! Can you send a photo of the printer settings screen?</Bubble>
          <Bubble side="left" who="You"><span className="inline-flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> printer-settings.jpg</span></Bubble>
          <Bubble side="right" who="EAJ Developer">Found it — pushing a fix now ✅</Bubble>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> First reply in 4 min</span>
          <span>Expected fix: today</span>
        </div>
      </div>
    </motion.div>
  );
}

function Bubble({ side, who, children }) {
  const right = side === 'right';
  return (
    <div className={cn('flex', right ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-xs',
        right ? 'rounded-br-sm bg-crimson/90 text-white' : 'rounded-bl-sm bg-navy-700 text-mist')}>
        <div className={cn('mb-0.5 text-[9px] font-semibold', right ? 'text-white/70' : 'text-muted-foreground')}>{who}</div>
        {children}
      </div>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl glass">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-medium text-mist">{q}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>}
    </div>
  );
}

function Section({ id, eyebrow, title, subtitle, children }) {
  return (
    <section id={id} className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-10 text-center">
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-crimson-soft">{eyebrow}</div>}
        <h2 className="text-3xl font-bold text-white sm:text-4xl">{title}</h2>
        {subtitle && <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>}
      </motion.div>
      {children}
    </section>
  );
}
