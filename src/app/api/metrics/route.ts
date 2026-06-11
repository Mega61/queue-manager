import { NextResponse } from 'next/server';
import { getManager } from '@/server/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ...getManager().status(), uptime: process.uptime() });
}
