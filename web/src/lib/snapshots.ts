// The numbers the site shows change in batches, not with every answer: a group's numbers (a quiz in
// a county or in the whole country) stay as they were computed until at
// least BATCH new people have answered or left that group, and at least MIN_GAP has passed. Live
// numbers would let someone who knows when a person answered read that person's answer in the
// difference; two batches differ by at least BATCH people. A person counts only when first answering:
// otherwise a few people sending their answers again and again could move the batch whenever they
// like, right after the person they watch. A changed answer is taken in with the next batch. Someone
// with BATCH - 1 new voters can still do it, once per set of voters: each costs a Turnstile check.
// Tables in migrations/0006_snapshots.sql. Server only.
import { env } from 'cloudflare:workers';

/** The fewest people whose changes a group's numbers take in at once. */
export const BATCH = 10;
/** The least time between two computations of a group's numbers. */
export const MIN_GAP = 60 * 60 * 1000;

const db = () => env.DB;

/** A statement that marks as changed, in its groups, whoever `select` returns as (key, who) rows,
 *  for a write's batch. Each person counts once per group until its numbers are computed again. */
export const changedWhere = (select: string, ...bind: unknown[]) =>
  db().prepare(`INSERT OR IGNORE INTO snapshot_changes (key, who) ${select}`).bind(...bind);

/** The group's numbers: as last computed, or computed again by `compute` when there are none yet or
 *  BATCH people changed something since, at least MIN_GAP ago. */
export async function snapshot<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const [snap, changes] = await db().batch([
    db().prepare('SELECT data, at FROM snapshots WHERE key = ?').bind(key),
    db().prepare('SELECT COUNT(*) AS n, MAX(rowid) AS last FROM snapshot_changes WHERE key = ?').bind(key),
  ]);
  const row = snap.results[0] as { data: string; at: number } | undefined;
  const { n, last } = changes.results[0] as { n: number; last: number | null };
  if (row && (n < BATCH || Date.now() - row.at < MIN_GAP)) return JSON.parse(row.data) as T;
  const value = await compute();
  // Only the changes counted above are taken in: one that lands while computing waits for the next.
  await db().batch([
    db()
      .prepare('INSERT INTO snapshots (key, data, at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET data = excluded.data, at = excluded.at')
      .bind(key, JSON.stringify(value), Date.now()),
    db().prepare('DELETE FROM snapshot_changes WHERE key = ? AND rowid <= ?').bind(key, last ?? 0),
  ]);
  return value;
}
