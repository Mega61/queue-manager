'use client';

import type { ManagerStatus, BrokerMessage } from '@/server/types';

export function MetricsBar({ status, messages }: { status: ManagerStatus | null; messages: BrokerMessage[] }) {
  const received = status?.buffer.lastSeq ?? 0;
  const buffered = status?.buffer.size ?? 0;
  const published = status?.publisher.published ?? 0;
  const errors = (status?.publisher.rejected ?? 0) + (status?.publisher.timeouts ?? 0);
  const now = Date.now();
  const perMin = messages.filter((m) => now - new Date(m.time).getTime() <= 60000).length;

  const items = [
    { v: received, l: 'Received', accent: true },
    { v: `${perMin}/min`, l: 'Throughput' },
    { v: buffered, l: 'Buffered' },
    { v: published, l: 'Published' },
    { v: errors, l: 'Errors' },
  ];

  return (
    <div className="grid grid-cols-5 gap-px border-b border-line bg-line">
      {items.map((it) => (
        <div key={it.l} className="bg-surface px-[18px] py-[13px]">
          <b className={`block font-mono text-[21px] font-medium tracking-tight ${it.accent ? 'text-mint-deep' : 'text-navy'}`}>{it.v}</b>
          <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-faint">{it.l}</span>
        </div>
      ))}
    </div>
  );
}
