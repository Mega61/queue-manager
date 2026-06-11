'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { prettyMaybe, highlightJson, escapeHtml } from '@/lib/format';
import type { BrokerMessage } from '@/server/types';

export function MessageFeed({ messages, onClear }: { messages: BrokerMessage[]; onClear: () => void }) {
  const [query, setQuery] = useState('');
  const [autoscroll, setAutoscroll] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => `${m.id} ${m.source} ${m.topic} ${m.body}`.toLowerCase().includes(q));
  }, [messages, query]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3.5 border-b border-line bg-white/60 px-5 py-3 backdrop-blur">
        <div className="text-[18px] font-extrabold italic tracking-tight text-navy">
          Live&nbsp;feed<span className="not-italic text-mint">›</span>
        </div>
        <div className="relative max-w-[340px] flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by id, source, topic or body…"
            className="w-full rounded-[9px] border border-line bg-white py-2 pl-8 pr-3 text-[13px] focus:border-mint focus:outline-none focus:ring-[3px] focus:ring-mint/20" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted">
            <input type="checkbox" checked={autoscroll} onChange={(e) => setAutoscroll(e.target.checked)} className="hidden" />
            <span className={cn('relative h-[17px] w-[30px] flex-none rounded-full transition-colors', autoscroll ? 'bg-mint-deep' : 'bg-[#cfd8dd]')}>
              <span className={cn('absolute top-0.5 h-[13px] w-[13px] rounded-full bg-white shadow transition-all', autoscroll ? 'left-[15px]' : 'left-0.5')} />
            </span>
            Auto-scroll
          </label>
          <a href="/api/messages/export?format=ndjson" className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-muted hover:text-mint-deep">Export</a>
          <button onClick={onClear} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-muted hover:text-foreground">Clear</button>
        </div>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 pb-7 pt-4', autoscroll && 'flex flex-col')}>
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3.5 text-center text-faint">
            <Image src="/assets/andante-logo.png" alt="" width={120} height={56} className="w-[120px] opacity-[.16]" />
            <div className="text-[20px] font-extrabold italic text-[#aab6bd]">
              {messages.length ? 'No matches' : 'Waiting for messages'} <span className="text-mint">›</span>
            </div>
            <div className="text-[12.5px]">{messages.length ? 'Adjust your filter.' : 'Connect and add a subscription to stream live traffic.'}</div>
          </div>
        ) : (
          filtered.map((m) => <MessageCard key={m.seq} m={m} />)
        )}
      </div>
    </main>
  );
}

function MessageCard({ m }: { m: BrokerMessage }) {
  const [open, setOpen] = useState(false);
  const { text, isJson } = useMemo(() => prettyMaybe(m.body), [m.body]);
  const html = useMemo(() => (isJson ? highlightJson(text) : escapeHtml(text)), [text, isJson]);

  return (
    <div className="mb-2.5 animate-slidein overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,30,40,.04),0_8px_24px_-12px_rgba(16,30,40,.18)]">
      <div onClick={() => setOpen((o) => !o)} className="flex cursor-pointer items-center gap-2.5 border-l-[3px] border-mint px-3 py-2.5 hover:bg-[#fbfcfd]">
        <span className="min-w-[34px] font-mono text-[11px] text-faint">#{m.seq}</span>
        <span className="max-w-[220px] truncate font-mono text-[12px] font-medium text-navy">{m.id}</span>
        <span className="truncate font-mono text-[11.5px] text-mint-deep">{m.topic || m.source}</span>
        {m.redelivered && <span className="flex-none rounded-full bg-[#fff1da] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-[#9a6a00]">redelivered</span>}
        <span className="flex-none rounded-full bg-[#eaf0f3] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-muted">{m.sourceType}</span>
        <span className="ml-auto flex-none font-mono text-[11px] text-faint">{new Date(m.time).toLocaleTimeString()}</span>
      </div>
      {open && (
        <div className="relative border-t border-line-2">
          <div className="absolute right-2.5 top-2 flex gap-1.5">
            <button onClick={() => navigator.clipboard.writeText(m.body)} className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-muted hover:text-mint-deep">Copy</button>
            <a href={`/api/messages/${m.seq}`} className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-muted hover:text-mint-deep">Download</a>
          </div>
          <pre className="m-0 max-h-[420px] overflow-auto px-4 py-3.5 font-mono text-[12px] leading-relaxed text-[#22323c]" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
