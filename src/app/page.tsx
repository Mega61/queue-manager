'use client';

import { useCallback } from 'react';
import { useSSE } from '@/hooks/use-sse';
import { api } from '@/lib/api';
import { BrandBar } from '@/components/brand-bar';
import { ConnectionCard } from '@/components/connection-card';
import { SubscriptionPanel } from '@/components/subscription-panel';
import { PublishPanel } from '@/components/publish-panel';
import { MetricsBar } from '@/components/metrics-bar';
import { MessageFeed } from '@/components/message-feed';

export default function Page() {
  const { status, messages, stream, clearMessages } = useSSE();

  const handleClear = useCallback(async () => {
    clearMessages();
    try { await api.clearMessages(); } catch { /* ignore */ }
  }, [clearMessages]);

  return (
    <div>
      <BrandBar status={status} stream={stream} />
      <div className="grid h-[calc(100vh-60px)] grid-cols-[404px_1fr] max-[900px]:grid-cols-1">
        <aside className="overflow-y-auto border-r border-line bg-gradient-to-b from-surface to-[#fbfcfd] px-5 pb-10 pt-5">
          <div className="space-y-4">
            <ConnectionCard status={status} />
            <SubscriptionPanel status={status} />
            <PublishPanel status={status} />
          </div>
        </aside>
        <div className="flex min-h-0 flex-col">
          <MetricsBar status={status} messages={messages} />
          <MessageFeed messages={messages} onClear={handleClear} />
        </div>
      </div>
    </div>
  );
}
