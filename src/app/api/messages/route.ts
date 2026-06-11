import { NextResponse } from 'next/server';
import { getManager } from '@/server/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const after = parseInt(url.searchParams.get('after') ?? '0', 10) || 0;
  const limit = parseInt(url.searchParams.get('limit') ?? '500', 10) || 500;
  const manager = getManager();
  return NextResponse.json({
    messages: manager.messagesAfter(after, limit),
    lastSeq: manager.status().buffer.lastSeq,
  });
}

export async function DELETE() {
  getManager().clearMessages();
  return NextResponse.json({ ok: true });
}
