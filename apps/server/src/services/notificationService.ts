import type { Database } from '../db.ts';
import { newId } from '../util/id.ts';

export interface Notification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export function pushNotification(
  db: Database,
  userId: string,
  kind: string,
  title: string,
  body: string,
): Notification {
  // Respect the user's notification preference.
  const settings = db
    .prepare('SELECT notifications_enabled FROM settings WHERE user_id = ?')
    .get(userId) as { notifications_enabled: number } | undefined;
  const id = newId('ntf');
  const createdAt = new Date().toISOString();
  if (settings && settings.notifications_enabled === 0) {
    return { id, userId, kind, title, body, createdAt, readAt: createdAt };
  }
  db.prepare(
    'INSERT INTO notifications (id, user_id, kind, title, body, created_at) VALUES (?,?,?,?,?,?)',
  ).run(id, userId, kind, title, body, createdAt);
  return { id, userId, kind, title, body, createdAt, readAt: null };
}

export function listNotifications(db: Database, userId: string, limit = 50): Notification[] {
  const rows = db
    .prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    .all(userId, limit) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    kind: String(r.kind),
    title: String(r.title),
    body: String(r.body),
    createdAt: String(r.created_at),
    readAt: r.read_at == null ? null : String(r.read_at),
  }));
}

export function markAllRead(db: Database, userId: string): number {
  const res = db
    .prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
    .run(new Date().toISOString(), userId);
  return Number(res.changes);
}

export function markRead(db: Database, userId: string, id: string): boolean {
  const res = db
    .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?')
    .run(new Date().toISOString(), id, userId);
  return Number(res.changes) > 0;
}
