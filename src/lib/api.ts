import type {
  Connection, ManagerStatus, Subscription, SubscriptionRequest, PublishRequest, PublishResult,
} from '@/server/types';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export const api = {
  status: () => fetch('/api/connection').then((r) => jsonOrThrow<ManagerStatus>(r)),

  connect: (conn: Connection) =>
    fetch('/api/connection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conn),
    }).then((r) => jsonOrThrow<{ ok: true; status: ManagerStatus }>(r)),

  disconnect: () => fetch('/api/connection', { method: 'DELETE' }).then((r) => jsonOrThrow(r)),

  addSubscription: (req: SubscriptionRequest) =>
    fetch('/api/subscriptions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
    }).then((r) => jsonOrThrow<{ ok: true; subscription: Subscription }>(r)),

  removeSubscription: (id: string) =>
    fetch(`/api/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) => jsonOrThrow(r)),

  publish: (req: PublishRequest) =>
    fetch('/api/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
    }).then((r) => jsonOrThrow<PublishResult & { ok: true }>(r)),

  clearMessages: () => fetch('/api/messages', { method: 'DELETE' }).then((r) => jsonOrThrow(r)),
};
