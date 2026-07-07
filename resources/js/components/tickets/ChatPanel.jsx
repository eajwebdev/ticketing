import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Paperclip, X, Lock, AtSign, ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import { getEcho } from '@/lib/echo';
import { useAuth } from '@/context/AuthContext';
import { useMessages } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/ui/avatar';
import { IconButton, Spinner } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { dateTime, fromNow } from '@/lib/format';

export function ChatPanel({ ticket }) {
  const { user } = useAuth();
  const isTeam = user?.role !== 'customer';
  const queryClient = useQueryClient();
  const { data: initialMessages, isLoading } = useMessages(ticket.id);

  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionable, setMentionable] = useState([]);
  const [pickedMentions, setPickedMentions] = useState([]);

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeout = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { if (initialMessages) setMessages(initialMessages); }, [initialMessages]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Mentionable list (team only)
  useEffect(() => {
    if (isTeam) {
      api.get(`/tickets/${ticket.id}/mentionable`).then((r) => setMentionable(r.data.data)).catch(() => {});
    }
  }, [ticket.id, isTeam]);

  // Realtime
  useEffect(() => {
    let channel;
    try {
      const echo = getEcho();
      channel = echo.join(`ticket.${ticket.id}`)
        .listen('.message.sent', (e) => {
          setMessages((prev) => (prev.some((m) => m.id === e.message.id) ? prev : [...prev, e.message]));
        })
        .listen('.user.typing', (e) => {
          if (e.user.id === user.id) return;
          setTypingUsers((prev) => (prev.find((u) => u.id === e.user.id) ? prev : [...prev, e.user]));
          setTimeout(() => setTypingUsers((prev) => prev.filter((u) => u.id !== e.user.id)), 2500);
        })
        .listen('.ticket.updated', () => {
          queryClient.invalidateQueries({ queryKey: ['ticket', String(ticket.id)] });
        });
    } catch (e) {
      console.warn('Realtime chat unavailable', e);
    }
    return () => {
      try { getEcho().leave(`ticket.${ticket.id}`); } catch { /* ignore */ }
    };
  }, [ticket.id, user.id, queryClient]);

  const broadcastTyping = () => {
    if (typingTimeout.current) return;
    api.post(`/tickets/${ticket.id}/typing`).catch(() => {});
    typingTimeout.current = setTimeout(() => { typingTimeout.current = null; }, 1500);
  };

  const onBodyChange = (e) => {
    const val = e.target.value;
    setBody(val);
    broadcastTyping();
    // detect @mention token at caret
    const caret = e.target.selectionStart;
    const upto = val.slice(0, caret);
    const match = upto.match(/@(\w*)$/);
    if (isTeam && match) setMentionQuery(match[1].toLowerCase());
    else setMentionQuery(null);
  };

  const insertMention = (member) => {
    setBody((prev) => prev.replace(/@(\w*)$/, `@${member.name.split(' ')[0]} `));
    setPickedMentions((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const addFiles = (list) => {
    const arr = Array.from(list).slice(0, 6 - files.length);
    setFiles((prev) => [...prev, ...arr]);
  };

  const onPaste = (e) => {
    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  };

  const send = async () => {
    if (!body.trim() && files.length === 0) return;
    setSending(true);
    const fd = new FormData();
    if (body.trim()) fd.append('body', body.trim());
    if (isInternal) fd.append('is_internal', '1');
    pickedMentions.forEach((id) => fd.append('mentions[]', id));
    files.forEach((f) => fd.append('attachments[]', f));
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/messages`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages((prev) => [...prev, data.data]);
      setBody(''); setFiles([]); setPickedMentions([]); setIsInternal(false);
    } catch {
      /* toast handled globally */
    } finally {
      setSending(false);
    }
  };

  const filteredMentions = mentionQuery != null
    ? mentionable.filter((m) => m.id !== user.id && m.name.toLowerCase().includes(mentionQuery))
    : [];

  const canChat = ['open', 'accepted', 'reopened', 'resolved'].includes(ticket.status);

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[420px] flex-col rounded-2xl glass">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex h-full items-center justify-center"><Spinner className="h-6 w-6" /></div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <ImageIcon className="mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} isOwn={m.user?.id === user.id} />)
        )}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-crimson-soft" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            {typingUsers.map((u) => u.name.split(' ')[0]).join(', ')} typing…
          </div>
        )}
      </div>

      {/* Composer */}
      {canChat ? (
        <div className="relative border-t border-navy-600/60 p-3">
          {/* Mention autocomplete */}
          {filteredMentions.length > 0 && (
            <div className="absolute bottom-full left-3 mb-2 w-72 overflow-hidden rounded-xl glass-strong shadow-2xl">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mention someone on this ticket</div>
              {filteredMentions.map((m) => {
                const isClient = m.role === 'customer';
                return (
                  <button key={m.id} onClick={() => insertMention(m)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-navy-700">
                    <UserAvatar user={m} className="h-6 w-6" />
                    <span className="text-mist">{m.name}</span>
                    {isClient ? (
                      <span className="ml-auto rounded-full bg-crimson/15 px-2 py-0.5 text-[10px] font-medium text-crimson-soft">Client</span>
                    ) : (
                      <span className="ml-auto truncate text-xs text-muted-foreground">{m.position}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* File previews */}
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="group relative">
                  {f.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 rounded-lg object-cover ring-1 ring-navy-600" />
                  ) : (
                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-lg bg-navy-700 p-1 text-center ring-1 ring-navy-600">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="mt-1 line-clamp-1 text-[9px] text-muted-foreground">{f.name}</span>
                    </div>
                  )}
                  <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-crimson p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isInternal && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-400">
              <Lock className="h-3 w-3" /> Internal note — the customer won't see this
            </div>
          )}

          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
            <IconButton label="Attach files" icon={Paperclip} onClick={() => fileInputRef.current?.click()} />
            {isTeam && (
              <IconButton label={isInternal ? 'Switch to public reply' : 'Internal note'} icon={Lock}
                onClick={() => setIsInternal((v) => !v)}
                className={isInternal ? 'text-amber-400 hover:text-amber-300' : ''} />
            )}
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={onBodyChange}
              onPaste={onPaste}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !mentionQuery) { e.preventDefault(); send(); } }}
              placeholder={isTeam ? 'Reply… use @ to mention a teammate' : 'Type your message…'}
              className="min-h-[44px] max-h-32 flex-1 py-2.5"
              rows={1}
            />
            <Button size="icon" onClick={send} disabled={sending || (!body.trim() && !files.length)} aria-label="Send">
              {sending ? <Spinner className="h-4 w-4" /> : <Send />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-navy-600/60 p-4 text-center text-sm text-muted-foreground">
          This ticket is closed. Reopen it to continue the conversation.
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, isOwn }) {
  const internal = message.is_internal;
  return (
    <div className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
      <UserAvatar user={message.user} className="h-8 w-8 shrink-0" />
      <div className={cn('max-w-[75%] min-w-0', isOwn && 'items-end')}>
        <div className={cn('flex items-center gap-2', isOwn && 'flex-row-reverse')}>
          <span className="text-xs font-medium text-mist">{message.user?.name}</span>
          <Tooltip label={dateTime(message.created_at)}>
            <span className="text-[10px] text-muted-foreground">{fromNow(message.created_at)}</span>
          </Tooltip>
        </div>
        <div
          className={cn(
            'mt-1 rounded-2xl px-4 py-2.5 text-sm',
            internal
              ? 'border border-amber-500/30 bg-amber-500/10 text-amber-100'
              : isOwn
                ? 'bg-crimson text-white'
                : 'bg-navy-700 text-mist'
          )}
        >
          {internal && <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400"><Lock className="h-2.5 w-2.5" /> Internal</div>}
          {message.body && <p className="whitespace-pre-wrap break-words">{renderMentions(message.body)}</p>}
          {message.attachments?.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {message.attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
                  {a.is_image ? (
                    <img src={a.url} alt={a.original_name} className="max-h-40 w-full rounded-lg object-cover ring-1 ring-white/10 transition-opacity hover:opacity-90" />
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs">
                      <Paperclip className="h-3.5 w-3.5" /> <span className="truncate">{a.original_name}</span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderMentions(text) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((p, i) =>
    p.startsWith('@') ? <span key={i} className="font-semibold text-crimson-soft">{p}</span> : p
  );
}
