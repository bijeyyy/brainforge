alter table flashcard_decks
  add column reviewer_id uuid references reviewers(id) on delete set null;

alter table quizzes
  add column reviewer_id uuid references reviewers(id) on delete set null;

alter table flashcard_decks drop column if exists subject_id;
alter table quizzes drop column if exists subject_id;

-- bagong nadiskubre: reviewers ay naka-link din sa subjects
alter table reviewers drop column if exists subject_id;

drop table if exists subjects;