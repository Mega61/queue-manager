import { getManager } from '@/server/manager';
import type { BusEvent } from '@/server/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Server-Sent Events stream: status / message / error, plus keepalive pings. */
export async function GET(req: Request) {
  const manager = getManager();
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      send('status', manager.status());
      unsubscribe = manager.bus.subscribe((ev: BusEvent) => send(ev.kind, ev.data));
      ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* closed */ }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        if (ping) clearInterval(ping);
        unsubscribe?.();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
