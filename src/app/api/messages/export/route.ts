import { getManager } from '@/server/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Bulk download of the buffered messages as NDJSON (default) or a JSON array. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'ndjson';
  const messages = getManager().allMessages();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  let payload: string;
  let contentType: string;
  let filename: string;
  if (format === 'json') {
    payload = JSON.stringify(messages, null, 2);
    contentType = 'application/json';
    filename = `messages-${stamp}.json`;
  } else {
    payload = messages.map((m) => JSON.stringify(m)).join('\n') + (messages.length ? '\n' : '');
    contentType = 'application/x-ndjson';
    filename = `messages-${stamp}.ndjson`;
  }

  return new Response(payload, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
