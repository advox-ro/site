-- Answers belong to a quiz (the redactor's quizzes/<id>.md), which a page names, not to the page:
-- the table and its column go back to their names from 0003. Renamed in place, so the answers
-- already sent stay; the quiz ids are the slugs they were stored under.
ALTER TABLE page_answers RENAME TO quiz_answers;
ALTER TABLE quiz_answers RENAME COLUMN page_slug TO quiz_slug;
DROP INDEX page_answers_page;
CREATE INDEX quiz_answers_quiz ON quiz_answers (quiz_slug, county);
