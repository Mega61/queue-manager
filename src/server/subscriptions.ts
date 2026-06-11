/** Pure helpers for decoding Solace messages and matching topic wildcards. */

import { solace } from './solace';

/**
 * Some runtime getters (e.g. getGuaranteedMessageId, getSdtContainer) are not
 * in the shipped .d.ts. Access them through this loose shape.
 */
type RawMessage = {
  getSdtContainer?: () => { getValue?: () => unknown } | null;
  getBinaryAttachment?: () => unknown;
  getXmlContent?: () => string | null;
  getDestination?: () => { getName?: () => string } | null;
  getGuaranteedMessageId?: () => unknown;
  getApplicationMessageId?: () => string | null;
  getCorrelationId?: () => string | null;
  isRedelivered?: () => boolean;
  getPriority?: () => number | null;
};

export interface DecodedMessage {
  id: string;
  topic: string;
  applicationMessageId: string | null;
  correlationId: string | null;
  redelivered: boolean;
  priority: number | null;
  bytes: number;
  body: string;
}

function decodeBody(m: RawMessage): string {
  try {
    const sdt = m.getSdtContainer?.();
    if (sdt) {
      const v = sdt.getValue?.();
      return typeof v === 'string' ? v : JSON.stringify(v);
    }
  } catch {
    /* fall through */
  }
  const bin = m.getBinaryAttachment?.();
  if (bin != null && bin !== '') {
    return typeof bin === 'string' ? bin : Buffer.from(bin as Uint8Array).toString('utf8');
  }
  return m.getXmlContent?.() ?? '';
}

export function decodeMessage(message: solace.Message, fallbackId: string): DecodedMessage {
  const m = message as unknown as RawMessage;
  const dest = m.getDestination?.();
  const body = decodeBody(m);
  let id = fallbackId;
  try {
    id = String(m.getGuaranteedMessageId?.() ?? m.getApplicationMessageId?.() ?? fallbackId);
  } catch {
    /* keep fallback */
  }
  return {
    id,
    topic: dest?.getName?.() ?? '',
    applicationMessageId: m.getApplicationMessageId?.() ?? null,
    correlationId: m.getCorrelationId?.() ?? null,
    redelivered: Boolean(m.isRedelivered?.()),
    priority: m.getPriority?.() ?? null,
    bytes: Buffer.byteLength(body),
    body,
  };
}

/**
 * Solace SMF topic wildcard match.
 *  - `*` matches exactly one level (text between `/`).
 *  - `>` matches one or more trailing levels (only meaningful at the end).
 */
export function topicMatches(pattern: string, topic: string): boolean {
  if (pattern === topic) return true;
  if (pattern.endsWith('>')) {
    const prefix = pattern.slice(0, -1); // includes trailing '/' if present
    if (prefix === '' ) return true;
    if (topic.startsWith(prefix)) return true;
  }
  const p = pattern.split('/');
  const t = topic.split('/');
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '>') return true; // matches the rest
    if (i >= t.length) return false;
    if (p[i] === '*') continue;
    if (p[i] !== t[i]) return false;
  }
  return p.length === t.length;
}
