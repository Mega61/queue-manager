'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { ManagerStatus } from '@/server/types';

const LS_KEY = 'aqm.conn';
const SAVED = ['url', 'vpnName', 'userName', 'clientName'] as const; // never the password

const PlugIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12h14M5 12l4-4M5 12l4 4" /><circle cx="19" cy="12" r="2" fill="currentColor" stroke="none" />
  </svg>
);

export function ConnectionCard({ status }: { status: ManagerStatus | null }) {
  const [form, setForm] = useState({ url: '', vpnName: '', userName: '', password: '', clientName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phase = status?.connection.phase ?? 'disconnected';
  const connected = phase === 'connected' || phase === 'reconnecting';

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      setForm((f) => ({ ...f, ...Object.fromEntries(SAVED.map((k) => [k, saved[k] ?? ''])) }));
    } catch { /* ignore */ }
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function persist(next: typeof form) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(SAVED.map((k) => [k, next[k]])))); } catch { /* ignore */ }
  }

  async function connect() {
    setBusy(true); setError(null); persist(form);
    try { await api.connect(form); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true);
    try { await api.disconnect(); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader icon={PlugIcon} title="Broker Connection" />
      <CardBody>
        <Label htmlFor="url" className="!mt-0">Broker URL</Label>
        <Input id="url" value={form.url} onChange={(e) => set('url', e.target.value)}
          disabled={connected} placeholder="wss://host.messaging.solace.cloud:443" autoComplete="off" />
        <Label htmlFor="vpn">Message VPN</Label>
        <Input id="vpn" value={form.vpnName} onChange={(e) => set('vpnName', e.target.value)} disabled={connected} autoComplete="off" />
        <Label htmlFor="user">Username</Label>
        <Input id="user" value={form.userName} onChange={(e) => set('userName', e.target.value)} disabled={connected} autoComplete="off" />
        <Label htmlFor="pw">
          Password <span className="font-medium normal-case tracking-normal text-faint">(entered here only — never stored)</span>
        </Label>
        <Input id="pw" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} disabled={connected} autoComplete="off" />
        <Label htmlFor="cn">
          Client Name <span className="font-medium normal-case tracking-normal text-faint">(shown in Solace console)</span>
        </Label>
        <Input id="cn" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} disabled={connected} autoComplete="off" />

        <div className="mt-4 flex gap-2.5">
          <Button variant="primary" className="flex-1" onClick={connect} disabled={busy || connected}>
            {phase === 'connecting' ? 'Connecting…' : connected ? 'Connected' : 'Connect'}
          </Button>
          <Button variant="navy" onClick={disconnect} disabled={busy || !connected}>Disconnect</Button>
        </div>

        {error && (
          <div className="mt-3.5 rounded-[10px] border border-[#f6c9c5] bg-[#fdeeed] px-3 py-2.5 text-xs font-semibold text-[#a8332b]">
            {error}
          </div>
        )}
        {status?.connection.lastError && !error && phase !== 'connected' && (
          <div className="mt-3.5 rounded-[10px] border border-[#f3e3b6] bg-[#fff8e8] px-3 py-2.5 text-xs font-semibold text-[#8a6400]">
            {status.connection.lastError}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
