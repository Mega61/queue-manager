import { describe, it, expect } from 'vitest';
import { GET as health } from '@/app/api/health/route';
import { GET as ready } from '@/app/api/ready/route';
import { GET as metrics } from '@/app/api/metrics/route';
import { GET as connStatus, POST as connect } from '@/app/api/connection/route';
import { POST as subscribe } from '@/app/api/subscriptions/route';
import { POST as publish } from '@/app/api/publish/route';
import { GET as messages } from '@/app/api/messages/route';

function post(url: string, body: unknown) {
  return new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('API route handlers (no broker)', () => {
  it('GET /api/health → ok', async () => {
    const res = await health();
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.status).toBe('ok');
    expect(typeof j.uptime).toBe('number');
  });

  it('GET /api/ready → disconnected state', async () => {
    const j = await (await ready()).json();
    expect(j.status).toBe('ready');
    expect(j.connected).toBe(false);
  });

  it('GET /api/metrics never leaks a password', async () => {
    const j = await (await metrics()).json();
    expect(j.connection).toBeTruthy();
    expect(j.publisher).toBeTruthy();
    expect(JSON.stringify(j).toLowerCase()).not.toContain('password');
  });

  it('GET /api/connection returns status with no secrets', async () => {
    const j = await (await connStatus()).json();
    expect(j.connection.phase).toBe('disconnected');
    expect(j.connection.config).toBeNull();
  });

  it('POST /api/connection validates required fields', async () => {
    const res = await connect(post('http://t/api/connection', {}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing field: url/);
  });

  it('POST /api/subscriptions validates type and requires connection', async () => {
    const bad = await subscribe(post('http://t/api/subscriptions', { type: 'nope', name: 'x' }));
    expect(bad.status).toBe(400);
    const notConnected = await subscribe(post('http://t/api/subscriptions', { type: 'queue', name: 'Q1' }));
    expect(notConnected.status).toBe(400);
    expect((await notConnected.json()).error).toMatch(/Not connected/);
  });

  it('POST /api/publish validates destination type', async () => {
    const res = await publish(post('http://t/api/publish', { destinationType: 'bad', destinationName: 'x' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/destinationType/);
  });

  it('GET /api/messages returns an (empty) list', async () => {
    const j = await (await messages(new Request('http://t/api/messages'))).json();
    expect(Array.isArray(j.messages)).toBe(true);
  });
});
