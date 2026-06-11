import { NextResponse } from 'next/server';
import { getManager } from '@/server/manager';
import type { Connection } from '@/server/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getManager().status());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const conn: Connection = {
    url: body.url, vpnName: body.vpnName, userName: body.userName,
    password: body.password, clientName: body.clientName,
  };
  for (const k of ['url', 'vpnName', 'userName', 'password'] as const) {
    if (!conn[k] || !String(conn[k]).trim()) {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
    }
  }
  try {
    await getManager().connect(conn);
    return NextResponse.json({ ok: true, status: getManager().status() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function DELETE() {
  await getManager().disconnect();
  return NextResponse.json({ ok: true });
}
