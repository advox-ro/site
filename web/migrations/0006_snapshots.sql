-- The numbers the site shows, in batches (src/lib/snapshots.ts). A group's numbers (a quiz's answers
-- in a county or in the whole country, the older quiz's averages) are kept as last computed and
-- recomputed only once at least 10 people changed something in that group since, so comparing two
-- of them never shows one person's answers.

-- key: the group ("quiz:<quiz id>:<county code or RO>", "avg:<county code or RO>"). data: its numbers,
-- as JSON. at: when they were computed (ms).
CREATE TABLE snapshots (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  at INTEGER NOT NULL
);

-- Who changed something in a group since its numbers were computed, once per person: a voter's or
-- a session's id. Emptied for the group each time its numbers are computed again.
CREATE TABLE snapshot_changes (
  key TEXT NOT NULL,
  who TEXT NOT NULL,
  PRIMARY KEY (key, who)
);
