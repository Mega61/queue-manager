'use client';

import { useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { ManagerStatus, DestinationType, TopicMode, Subscription } from '@/server/types';

const ListIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
);

const PHASE_STYLE: Record<Subscription['phase'], string> = {
  up: 'bg-mint-soft text-[#0a6f53]',
  binding: 'bg-[#fff8e8] text-[#8a6400]',
  reconnecting: 'bg-[#fff8e8] text-[#8a6400]',
  down: 'bg-[#fdeeed] text-[#a8332b]',
  error: 'bg-[#fdeeed] text-[#a8332b]',
  removed: 'bg-[#eef1f3] text-muted',
};

export function SubscriptionPanel({ status }: { status: ManagerStatus | null }) {
  const connected = status?.connection.phase === 'connected' || status?.connection.phase === 'reconnecting';
  const subs = status?.subscriptions ?? [];

  const [type, setType] = useState<DestinationType>('queue');
  const [name, setName] = useState('');
  const [topicMode, setTopicMode] = useState<TopicMode>('direct');
  const [backingQueue, setBackingQueue] = useState('');
  const [autoAck, setAutoAck] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showAck = type === 'queue' || (type === 'topic' && topicMode === 'guaranteed');

  async function add() {
    if (!name.trim()) { setError('Enter a queue name or topic.'); return; }
    setBusy(true); setError(null);
    try {
      await api.addSubscription({
        type, name: name.trim(),
        topicMode: type === 'topic' ? topicMode : undefined,
        backingQueue: type === 'topic' && topicMode === 'guaranteed' && backingQueue.trim() ? backingQueue.trim() : undefined,
        autoAck: showAck ? autoAck : undefined,
      });
      setName('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader icon={ListIcon} title="Subscribe" />
      <CardBody>
        <Label className="!mt-0">Source type</Label>
        <Segmented value={type} onChange={setType}
          options={[{ value: 'queue', label: 'Queue' }, { value: 'topic', label: 'Topic' }]} />

        <Label htmlFor="subname" className="mt-3.5">{type === 'queue' ? 'Queue name' : 'Topic'}</Label>
        <Input id="subname" value={name} onChange={(e) => setName(e.target.value)} disabled={!connected}
          placeholder={type === 'queue' ? 'NAZAN.STOREFRONT...' : 'NAZAN/STOREFRONT/>'} autoComplete="off" />

        {type === 'topic' && (
          <>
            <Label>Delivery</Label>
            <Segmented value={topicMode} onChange={setTopicMode}
              options={[{ value: 'direct', label: 'Direct (live)' }, { value: 'guaranteed', label: 'Guaranteed' }]} />
            {topicMode === 'guaranteed' && (
              <>
                <Label htmlFor="bq">Backing queue <span className="font-medium normal-case tracking-normal text-faint">(blank = temporary)</span></Label>
                <Input id="bq" value={backingQueue} onChange={(e) => setBackingQueue(e.target.value)} disabled={!connected} autoComplete="off" />
              </>
            )}
          </>
        )}

        {showAck && (
          <label className="mt-3.5 flex cursor-pointer items-start gap-2.5 text-[12.5px] text-muted">
            <input type="checkbox" checked={autoAck} onChange={(e) => setAutoAck(e.target.checked)}
              className="mt-0.5 h-[15px] w-[15px] accent-mint-deep" />
            <span>Auto-ACK — consume (remove) messages as they are read</span>
          </label>
        )}

        <Button variant="primary" className="mt-4 w-full" onClick={add} disabled={busy || !connected}>Add subscription</Button>
        {error && <div className="mt-3 rounded-[10px] border border-[#f6c9c5] bg-[#fdeeed] px-3 py-2 text-xs font-semibold text-[#a8332b]">{error}</div>}
        {!connected && <p className="mt-2.5 text-[11.5px] leading-snug text-faint">Connect to a broker to add subscriptions.</p>}

        {subs.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-line-2 pt-3.5">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-[10px] border border-line bg-[#fbfcfd] px-2.5 py-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide', PHASE_STYLE[s.phase])}>{s.phase}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[11.5px] text-navy">{s.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-faint">
                    {s.type}{s.topicMode ? ` · ${s.topicMode}` : ''} · {s.received} msg
                  </div>
                </div>
                <button onClick={() => api.removeSubscription(s.id)} title="Remove"
                  className="rounded-full border border-line bg-white px-2 py-1 text-[11px] font-bold text-muted hover:border-err hover:text-err">✕</button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
