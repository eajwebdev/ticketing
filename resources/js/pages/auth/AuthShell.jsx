import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '@/components/brand/Logo';
import { ShieldCheck, Zap, MessagesSquare } from 'lucide-react';

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand side */}
      <div className="relative hidden overflow-hidden grad-brand lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage:
            'radial-gradient(50% 40% at 20% 15%, rgba(255,77,117,0.35), transparent 60%), radial-gradient(40% 40% at 85% 80%, rgba(29,48,96,0.7), transparent 60%)',
        }} />
        <Link to="/" className="relative z-10"><Logo variant="badge" size="lg" /></Link>
        <div className="relative z-10 space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="max-w-md text-3xl font-bold leading-tight text-white"
          >
            Support that proves <span className="grad-text">EAJ cares</span> — tracked from first message to resolved.
          </motion.h2>
          <div className="space-y-3">
            {[
              { icon: Zap, text: 'Lightning-fast response times, measured and visible' },
              { icon: MessagesSquare, text: 'Real-time chat with the humans behind your system' },
              { icon: ShieldCheck, text: 'Full transparency: who accepted, who solved, how long' },
            ].map(({ icon: Icon, text }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3 text-mist/90"
              >
                <div className="rounded-lg bg-white/10 p-2"><Icon className="h-4 w-4 text-crimson-soft" /></div>
                <span className="text-sm">{text}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-mist/50">© {new Date().getFullYear()} EAJ Systems. All rights reserved.</div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden"><Logo variant="badge" size="lg" /></div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </motion.div>
      </div>
    </div>
  );
}
