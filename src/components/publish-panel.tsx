'use client';

import { useRef, useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import type { ManagerStatus, DestinationType, DeliveryMode } from '@/server/types';

const SendIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
  </svg>
);

type Status = { kind: 'ok' | 'err' | 'busy'; text: string } | null;

/** Parse an uploaded file into batch entries (JSON array or NDJSON) or a single body. */
function parseUpload(text: string): { batch?: unknown[]; body?: string } {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return { batch: parsed };
    return { body: JSON.stringify(parsed, null, 2) };
  } catch { /* try ndjson */ }
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    try { return { batch: lines.map((l) => JSON.parse(l)) }; } catch { /* fall through */ }
  }
  return { body: text };
}

export function PublishPanel({ status }: { status: ManagerStatus | null }) {
  const connected = status?.connection.phase === 'connected' || status?.connection.phase === 'reconnecting';
  const [destType, setDestType] = useState<DestinationType>('topic');
  const [destName, setDestName] = useState('');
  const [mode, setMode] = useState<DeliveryMode>('persistent');
  const [body, setBody] = useState('');
  const [batch, setBatch] = useState<unknown[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Status>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function format() {
    try { setBody(JSON.stringify(JSON.parse(body), null, 2)); setMsg({ kind: 'ok', text: 'Formatted.' }); }
    catch (e) { setMsg({ kind: 'err', text: `Not valid JSON: ${(e as Error).message}` }); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseUpload(text);
    if (parsed.batch) { setBatch(parsed.batch); setMsg({ kind: 'ok', text: `Loaded ${parsed.batch.length} messages for batch publish.` }); }
    else { setBody(parsed.body ?? text); setBatch(null); setMsg({ kind: 'ok', text: `Loaded ${file.name}.` }); }
    if (fileRef.current) fileRef.current.value = '';
  }

  function download() {
    const content = batch ? JSON.stringify(batch, null, 2) : body;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payload-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function send() {
    if (!destName.trim()) { setMsg({ kind: 'err', text: 'Destination name is required.' }); return; }
    setBusy(true);
    setMsg({ kind: 'busy', text: `Publishing to ${destType} '${destName}'…` });
    try {
      const res = await api.publish({
        destinationType: destType, destinationName: destName.trim(), deliveryMode: mode,
        ...(batch ? { batch } : { body }),
      });
      const fail = res.failures.length;
      setMsg({
        kind: fail ? 'err' : 'ok',
        text: `Sent ${res.count - fail}/${res.count} to ${res.destinationType} '${res.destinationName}' · ${res.bytes} bytes${fail ? ` · ${fail} failed: ${res.failures[0].error}` : (mode === 'persistent' ? ' · acked' : ' · direct')}`,
      });
    } catch (e) { setMsg({ kind: 'err', text: `Failed: ${(e as Error).message}` }); }
    finally { setBusy(false); }
  }

  const statusColor = msg?.kind === 'ok' ? 'border-[#a9efd8] bg-mint-soft text-[#0a6f53]'
    : msg?.kind === 'err' ? 'border-[#f6c9c5] bg-[#fdeeed] text-[#a8332b]'
    : 'border-[#f3e3b6] bg-[#fff8e8] text-[#8a6400]';

  return (
    <Card>
      <CardHeader icon={SendIcon} title="Publish" />
      <CardBody>
        <Label className="!mt-0">Destination type</Label>
        <Segmented value={destType} onChange={setDestType}
          options={[{ value: 'topic', label: 'Topic' }, { value: 'queue', label: 'Queue' }]} />
        <Label htmlFor="dn" className="mt-3.5">Destination name</Label>
        <Input id="dn" value={destName} onChange={(e) => setDestName(e.target.value)} placeholder="NAZAN/STOREFRONT/..." autoComplete="off" />
        <Label>Delivery mode</Label>
        <Segmented value={mode} onChange={setMode}
          options={[{ value: 'persistent', label: 'Persistent' }, { value: 'direct', label: 'Direct' }]} />

        <div className="mt-3.5 flex items-center justify-between">
          <Label className="!mt-0" htmlFor="pb">Message body</Label>
          <div className="flex gap-1.5">
            <input ref={fileRef} type="file" accept=".json,.ndjson,.txt,application/json" onChange={onFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-muted hover:text-mint-deep">Upload</button>
            <button onClick={download} className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-muted hover:text-mint-deep">Download</button>
          </div>
        </div>

        {batch ? (
          <div className="flex items-center justify-between rounded-[9px] border border-mint/40 bg-mint-soft px-3 py-2.5 text-xs font-semibold text-[#0a6f53]">
            <span>📦 Batch ready · {batch.length} messages</span>
            <button onClick={() => setBatch(null)} className="font-bold text-[#0a6f53] underline">clear</button>
          </div>
        ) : (
          <Textarea id="pb" value={body} onChange={(e) => setBody(e.target.value)} placeholder={'{ "OrderId": "123" }'} />
        )}

        <div className="mt-4 flex gap-2.5">
          <Button variant="primary" className="flex-1" onClick={send} disabled={busy || !connected}>
            {batch ? `Send ${batch.length}` : 'Send'}
          </Button>
          {!batch && <Button variant="ghost" onClick={format}>Format</Button>}
        </div>

        {msg && <div className={`mt-3 rounded-[10px] border px-3 py-2.5 text-xs font-semibold ${statusColor}`}>{msg.text}</div>}
        <p className="mt-2.5 text-[11.5px] leading-snug text-faint">
          Persistent waits for a broker ack; direct is fire-and-forget. Upload a JSON array or NDJSON to batch-publish (replay).
        </p>
      </CardBody>
    </Card>
  );
}
