-- The quizzes are pages in the code (the redactor's pages/*.md): their answers' table and column take
-- the name. Renamed in place, so the answers already sent stay.
ALTER TABLE quiz_answers RENAME TO page_answers;
ALTER TABLE page_answers RENAME COLUMN quiz_slug TO page_slug;
DROP INDEX quiz_answers_quiz;
CREATE INDEX page_answers_page ON page_answers (page_slug, county);
