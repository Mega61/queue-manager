'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ManagerStatus, BrokerMessage } from '@/server/types';

const MAX_MESSAGES = 800; // cap client-side memory on long runs

export type StreamState = 'connecting' | 'open' | 'closed';

export function useSSE() {
  const [status, setStatus] = useState<ManagerStatus | null>(null);
  const [messages, setMessages] = useState<BrokerMessage[]>([]);
  const [stream, setStream] = useState<StreamState>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/events');
    esRef.current = es;
    es.onopen = () => setStream('open');
    es.onerror = () => setStream('closed');
    es.addEventListener('status', (e) => setStatus(JSON.parse((e as MessageEvent).data)));
    es.addEventListener('message', (e) => {
      const msg: BrokerMessage = JSON.parse((e as MessageEvent).data);
      setMessages((prev) => {
        const next = [msg, ...prev];
        return next.length > MAX_MESSAGES ? next.slice(0, MAX_MESSAGES) : next;
      });
    });
    es.addEventListener('error', (e) => {
      const data = (e as MessageEvent).data;
      if (data) { try { setLastError(JSON.parse(data).message); } catch { /* ignore */ } }
    });
    return () => { es.close(); esRef.current = null; };
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { status, messages, stream, lastError, clearMessages };
}
