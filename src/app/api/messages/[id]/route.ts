import { NextResponse } from 'next/server';
import { getManager } from '@/server/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Download a single message body as a .json attachment (pretty-printed if JSON). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const msg = getManager().getMessage(id);
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  let payload = msg.body;
  try { payload = JSON.stringify(JSON.parse(msg.body), null, 2); } catch { /* keep raw */ }

  const safe = (msg.id || String(msg.seq)).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return new Response(payload, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="message-${safe}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
