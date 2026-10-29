-- The quizzes' storage (src/lib/set-store.ts).

-- One row per browser that picked a county and an age on /welcome. id: 128 random bits, kept in the
-- browser's HttpOnly cookie "voter". created_at: the day (UTC midnight, in ms).
CREATE TABLE voters (
  id TEXT PRIMARY KEY,
  county TEXT NOT NULL,
  age TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- A finished quiz's answers, one row per question, sent once the quiz is done.
-- choices: the picked choice ids as a JSON array, null when skipped.
-- county, age: the voter's when the quiz was sent, so picking another county later doesn't move them.
-- answered_at: the day (UTC midnight, in ms).
-- Deleting a voter deletes its answers.
CREATE TABLE quiz_answers (
  voter_id TEXT NOT NULL REFERENCES voters (id) ON DELETE CASCADE,
  quiz_slug TEXT NOT NULL,
  qid TEXT NOT NULL,
  choices TEXT,
  county TEXT NOT NULL,
  age TEXT NOT NULL,
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (voter_id, quiz_slug, qid)
);
CREATE INDEX quiz_answers_quiz ON quiz_answers (quiz_slug, county);
