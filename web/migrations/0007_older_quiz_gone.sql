-- The 20-question quiz is gone, with its answers and the numbers computed from them.
DROP TABLE expected;
DROP TABLE answers;
DROP TABLE sessions;
DELETE FROM snapshots WHERE key LIKE 'avg:%' OR key LIKE 'averages:%';
DELETE FROM snapshot_changes WHERE key LIKE 'avg:%' OR key LIKE 'averages:%';
