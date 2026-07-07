import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatCard({ icon: Icon, label, value, sub, trend, index = 0, accent = '#e91e4f' }) {
  const up = trend != null && trend >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="hover-lift rounded-2xl glass p-5"
    >
      <div className="flex items-start justify-between">
        <div className="rounded-xl p-2.5" style={{ background: `${accent}1f`, color: accent }}>
          <Icon className="h-5 w-5" />
        </div>
        {trend != null && (
          <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', up ? 'text-emerald-400' : 'text-crimson-soft')}>
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-4 text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground/70">{sub}</div>}
    </motion.div>
  );
}
