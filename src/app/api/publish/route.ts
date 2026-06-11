import { NextResponse } from 'next/server';
import { getManager } from '@/server/manager';
import type { PublishRequest } from '@/server/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.destinationType !== 'queue' && body.destinationType !== 'topic') {
    return NextResponse.json({ error: "destinationType must be 'queue' or 'topic'" }, { status: 400 });
  }
  if (!body.destinationName || !String(body.destinationName).trim()) {
    return NextResponse.json({ error: 'Missing field: destinationName' }, { status: 400 });
  }
  if (body.batch != null && !Array.isArray(body.batch)) {
    return NextResponse.json({ error: 'batch must be an array' }, { status: 400 });
  }
  const preq: PublishRequest = {
    destinationType: body.destinationType,
    destinationName: String(body.destinationName),
    deliveryMode: body.deliveryMode === 'direct' ? 'direct' : 'persistent',
    body: body.body,
    batch: body.batch,
  };
  try {
    const result = await getManager().publish(preq);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
