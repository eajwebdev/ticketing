import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Ticket, MessagesSquare, CheckCircle2, Zap, Eye, Clock,
  ShieldCheck, Sparkles,
} from 'lucide-react';
import { systemIcon } from '@/lib/systemIcons';
import api from '@/lib/api';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { humanizeMinutes } from '@/lib/format';


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
  const [team, setTeam] = useState([]);
  const [live, setLive] = useState(null);

  useEffect(() => {
    api.get('/system-types').then((r) => setSystemTypes(r.data.data)).catch(() => {});
    api.get('/team').then((r) => setTeam(r.data.data)).catch(() => {});
    api.get('/stats').then((r) => setLive(r.data)).catch(() => {});
  }, []);

  // Real numbers from the reports endpoint (cached server-side).
  const avgMins = live?.avg_response_minutes;
  const responseStat = avgMins == null
    ? { value: null, suffix: '' }
    : avgMins < 60
      ? { value: avgMins, suffix: 'm' }
      : { value: Math.round(avgMins / 60), suffix: 'h' };

  const stats = [
    { label: 'Tickets resolved', value: live?.tickets_resolved, suffix: '' },
    { label: 'Avg response time', ...responseStat },
    { label: 'Systems supported', value: live?.systems_supported ?? systemTypes.length },
    { label: 'Client satisfaction', value: live?.satisfaction_percent, suffix: '%' },
  ];

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-navy-600/40 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/login">Login</Link></Button>
            <Button asChild size="sm"><Link to="/register">Get started <ArrowRight /></Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="bg-grid absolute inset-0 opacity-60" />
          <div className="absolute left-1/4 top-10 h-80 w-80 animate-float rounded-full bg-crimson/20 blur-[110px]" />
          <div className="absolute right-1/4 top-40 h-80 w-80 animate-float rounded-full bg-navy-500/40 blur-[110px]" style={{ animationDelay: '2s' }} />
          <div className="absolute left-1/2 top-72 h-64 w-64 -translate-x-1/2 animate-float rounded-full bg-crimson-soft/10 blur-[90px]" style={{ animationDelay: '4s' }} />
        </div>
        <div className="mx-auto max-w-7xl px-6 py-24 text-center lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-crimson/30 bg-crimson/10 px-4 py-1.5 text-xs font-medium text-crimson-soft backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson-soft opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-crimson-soft" />
            </span>
            After-sales support, reimagined
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5 }}
            className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Support so good, it's{' '}
            <span className="grad-text-animated">proof</span> you chose EAJ.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
          >
            Submit a ticket, chat with real developers in real time, and watch every second get tracked —
            from first response to fully resolved.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button asChild size="lg" className="btn-shine animate-pulse-glow"><Link to="/register"><Ticket /> Create a Ticket</Link></Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button asChild size="lg" variant="outline" className="backdrop-blur"><Link to="/login">Login / Register</Link></Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats band — real numbers from the reports endpoint */}
        <div className="mx-auto max-w-6xl px-6 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="grad-border relative grid grid-cols-2 gap-4 rounded-2xl glass p-6 sm:grid-cols-4 sm:divide-x sm:divide-navy-600/50"
          >
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
      <Section title="Systems we support" subtitle="One platform, every EAJ product — new systems appear here automatically.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(systemTypes.length ? systemTypes : [{ id: 1, name: 'Laundry System', icon: 'WashingMachine' }, { id: 2, name: 'Restaurant Management System', icon: 'UtensilsCrossed' }, { id: 3, name: 'Retail POS', icon: 'Store' }, { id: 4, name: 'Pharmacy', icon: 'Pill' }]).map((s, i) => {
            const Icon = systemIcon(s.icon);
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="hover-lift group rounded-2xl glass p-6 text-center hover:border-crimson/40">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl grad-brand shadow-[0_0_20px_rgba(233,30,79,0.35)] transition-transform group-hover:scale-110">
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-semibold text-mist">{s.name}</h3>
                {s.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* How it works */}
      <Section title="How it works" subtitle="Three steps. Zero guesswork.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { icon: Ticket, title: 'Submit', text: 'Create a ticket with your system, category, and urgency in seconds.' },
            { icon: MessagesSquare, title: 'We accept & chat', text: 'A developer picks it up and chats with you live — images included.' },
            { icon: CheckCircle2, title: 'Resolved & tracked', text: 'We solve it, and every response & resolution time is recorded.' },
          ].map((step, i) => (
            <motion.div key={step.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="relative rounded-2xl glass p-7">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-crimson/15 text-crimson-soft">
                <step.icon className="h-6 w-6" />
              </div>
              <div className="absolute right-6 top-6 text-5xl font-bold text-navy-600/60">{i + 1}</div>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Meet the team */}
      {team.length > 0 && (
        <Section title="Meet the support team" subtitle="Real people behind every resolved ticket.">
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

      {/* Why EAJ */}
      <Section title="Why EAJ support" subtitle="Speed, transparency, and real-time chat — all measurable.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { icon: Zap, title: 'Fast by design', text: 'First-response and resolution times are tracked and shown as proof — not promises.' },
            { icon: Eye, title: 'Full transparency', text: 'See who accepted, who solved, and how long each stage took.' },
            { icon: ShieldCheck, title: 'Real-time & secure', text: 'Live chat over private channels, with image sharing and internal collaboration.' },
          ].map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="rounded-2xl glass p-7">
              <f.icon className="h-8 w-8 text-crimson-soft" />
              <h3 className="mt-4 text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl grad-brand p-10 text-center sm:p-16">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(40% 60% at 50% 0%, rgba(255,77,117,0.4), transparent 70%)' }} />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to experience support done right?</h2>
            <p className="mx-auto mt-3 max-w-xl text-mist/80">Join the EAJ clients who never wonder where their ticket stands.</p>
            <Button asChild size="lg" className="mt-8"><Link to="/register"><Ticket /> Create your first ticket</Link></Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy-600/40 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EAJ Systems. Support that proves it.</p>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">{title}</h2>
        {subtitle && <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>}
      </motion.div>
      {children}
    </section>
  );
}
