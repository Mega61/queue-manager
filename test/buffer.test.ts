import { describe, it, expect } from 'vitest';
import { MessageBuffer } from '@/server/buffer';
import type { BrokerMessage } from '@/server/types';

function make(id: string, body = '{}'): Omit<BrokerMessage, 'seq'> {
  return {
    id, subscriptionId: 'sub-1', source: 'Q', sourceType: 'queue', topic: '',
    applicationMessageId: null, correlationId: null, redelivered: false,
    priority: null, bytes: body.length, time: new Date().toISOString(), body,
  };
}

describe('MessageBuffer', () => {
  it('assigns monotonic seq and grows', () => {
    const b = new MessageBuffer(10);
    const a = b.push(make('a'));
    const c = b.push(make('c'));
    expect(a.seq).toBe(1);
    expect(c.seq).toBe(2);
    expect(b.size).toBe(2);
    expect(b.lastSeq).toBe(2);
  });

  it('evicts oldest beyond capacity but keeps seq counter', () => {
    const b = new MessageBuffer(3);
    for (let i = 0; i < 5; i++) b.push(make(`m${i}`));
    expect(b.size).toBe(3);
    expect(b.lastSeq).toBe(5);
    expect(b.all().map((m) => m.id)).toEqual(['m2', 'm3', 'm4']);
  });

  it('returns messages after a cursor', () => {
    const b = new MessageBuffer(10);
    for (let i = 0; i < 4; i++) b.push(make(`m${i}`));
    expect(b.after(2).map((m) => m.seq)).toEqual([3, 4]);
    expect(b.after(4)).toEqual([]);
  });

  it('gets by id or seq, and clears', () => {
    const b = new MessageBuffer(10);
    b.push(make('xyz'));
    expect(b.get('xyz')?.id).toBe('xyz');
    expect(b.get('1')?.seq).toBe(1);
    b.clear();
    expect(b.size).toBe(0);
  });
});
