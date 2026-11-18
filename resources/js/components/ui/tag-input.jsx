import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const norm = (s) => s.trim().toLowerCase();

/**
 * Multi-value text input: type a value, press Enter (or comma, unless splitOnComma
 * is false — e.g. business names like "Cruz, Inc.") to add it as a chip.
 * Backspace on an empty field removes the last chip. Text left in the field is
 * added on blur, so it isn't lost when the form is submitted.
 */
export function TagInput({ value = [], onChange, placeholder, suggestions = [], max = 20, splitOnComma = true, className }) {
  const [text, setText] = useState('');

  const add = (raw) => {
    const parts = (splitOnComma ? raw.split(',') : [raw]).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    parts.forEach((p) => {
      if (next.length < max && !next.some((v) => norm(v) === norm(p))) next.push(p);
    });
    onChange(next);
    setText('');
  };

  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || (splitOnComma && e.key === ',')) {
      e.preventDefault(); // don't submit the surrounding form
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value.length - 1);
    }
  };

  const unused = suggestions.filter((s) => !value.some((v) => norm(v) === norm(s)));

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-navy-600 bg-navy-800/60 px-3 py-2',
          'transition-colors focus-within:border-crimson/60 focus-within:ring-2 focus-within:ring-crimson/30',
          className
        )}
      >
        {value.map((t, i) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-crimson/15 py-0.5 pl-2 pr-1 text-xs font-medium text-crimson-soft">
            {t}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${t}`}
              className="rounded p-0.5 hover:bg-crimson/25 hover:text-white">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => (splitOnComma && e.target.value.includes(',') ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={onKeyDown}
          onBlur={() => add(text)}
          placeholder={value.length ? 'Add another…' : placeholder}
          disabled={value.length >= max}
          className="min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-mist outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)}
              className="rounded-lg border border-dashed border-navy-600 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-crimson/50 hover:text-mist">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
