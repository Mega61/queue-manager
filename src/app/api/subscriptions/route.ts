import { NextResponse } from 'next/server';
import { getManager } from '@/server/manager';
import type { SubscriptionRequest } from '@/server/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ subscriptions: getManager().status().subscriptions });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.type !== 'queue' && body.type !== 'topic') {
    return NextResponse.json({ error: "type must be 'queue' or 'topic'" }, { status: 400 });
  }
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: 'Missing field: name' }, { status: 400 });
  }
  if (body.type === 'topic' && body.topicMode && body.topicMode !== 'direct' && body.topicMode !== 'guaranteed') {
    return NextResponse.json({ error: "topicMode must be 'direct' or 'guaranteed'" }, { status: 400 });
  }
  const sreq: SubscriptionRequest = {
    type: body.type,
    name: String(body.name),
    topicMode: body.topicMode,
    backingQueue: body.backingQueue,
    autoAck: body.autoAck,
  };
  try {
    const sub = await getManager().addSubscription(sreq);
    return NextResponse.json({ ok: true, subscription: sub });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
