'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { ManagerStatus } from '@/server/types';
import type { StreamState } from '@/hooks/use-sse';

const PHASE_LABEL: Record<string, string> = {
  disconnected: 'offline', connecting: 'connecting', connected: 'live',
  reconnecting: 'reconnecting', error: 'error',
};

export function BrandBar({ status, stream }: { status: ManagerStatus | null; stream: StreamState }) {
  const phase = status?.connection.phase ?? 'disconnected';
  const reconnects = status?.connection.reconnects ?? 0;
  const subs = status?.subscriptions.length ?? 0;

  const dot =
    phase === 'connected' ? 'bg-mint animate-[pulse_1.8s_ease-out_infinite]'
    : phase === 'reconnecting' || phase === 'connecting' ? 'bg-[#ffce4d]'
    : phase === 'error' ? 'bg-[#ff7a6e]' : 'bg-faint';

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-5 border-b border-[#0a161d] bg-gradient-to-r from-navy to-navy-2 px-[22px]">
      <Image src="/assets/andante-logo.png" alt="Andante Labs" width={120} height={26}
        className="h-[26px] w-auto brightness-0 invert" priority />
      <div className="h-[26px] w-px bg-navy-line" />
      <div className="text-[13px] font-semibold tracking-[0.02em] text-[#cfe7e0]">
        Queue&nbsp;Manager <span className="font-extrabold text-mint">›</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-[18px]">
        <Stat value={String(subs)} label="subs" />
        <Stat value={String(reconnects)} label="reconnects" />
        <div className="inline-flex items-center gap-2 rounded-full border border-navy-line bg-white/[.06] py-1.5 pl-[11px] pr-[13px] text-[12.5px] font-semibold text-[#dfe9ee]">
          <span className={cn('h-2 w-2 rounded-full', dot)} />
          {stream === 'closed' ? 'stream lost' : PHASE_LABEL[phase]}
        </div>
      </div>
    </header>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-right leading-[1.1]">
      <b className="block font-mono text-[15px] font-medium text-white">{value}</b>
      <span className="text-[10px] uppercase tracking-[0.12em] text-[#7f97a2]">{label}</span>
    </div>
  );
}
