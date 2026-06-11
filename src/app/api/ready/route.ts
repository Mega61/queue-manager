import { NextResponse } from 'next/server';
import { getManager } from '@/server/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getManager().status();
  return NextResponse.json({
    status: 'ready',
    connected: s.connection.phase === 'connected',
    subscriptions: s.subscriptions.length,
  });
}
