-- ═══════════════════════════════════════════════════════════════
-- BrainForge AI — Supabase schema
-- Run this whole file in: Supabase Dashboard -> SQL Editor -> New query
-- ═══════════════════════════════════════════════════════════════

-- ── 1. PROFILES (one row per auth user) ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  xp integer not null default 0,
  coins integer not null default 0,
  streak integer not null default 0,
  last_study_date date,
  exam_name text,
  exam_date date,
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Learner'),
    split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. SUBJECTS ─────────────────────────────────────────────────
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  icon text not null default '📚',
  difficulty text not null default 'Medium' check (difficulty in ('Easy','Medium','Hard')),
  total_lessons integer not null default 0,
  completed_lessons integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── 3. FLASHCARDS ───────────────────────────────────────────────
create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  front text not null,
  back text not null,
  interval_days integer not null default 0,   -- spaced repetition interval
  due_date date not null default current_date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── 4. QUIZZES & QUESTIONS (mock exams are quizzes with is_exam) ─
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  is_exam boolean not null default false,
  duration_minutes integer not null default 10,
  passing_percent integer not null default 75,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null,
  options jsonb not null,           -- e.g. ["A","B","C","D"]
  correct_index integer not null,
  explanation text,
  topic text default 'General'
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete set null,
  mode text not null default 'quiz' check (mode in ('quiz','exam','challenge')),
  score integer not null,
  total integer not null,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── 5. XP EVENTS (feeds leaderboard + progress charts) ──────────
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ── 6. DAILY CHALLENGE ──────────────────────────────────────────
create table public.daily_challenges (
  challenge_date date primary key default current_date,
  questions jsonb not null          -- [{prompt, options, correct_index}]
);

create table public.daily_challenge_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_date date not null,
  score integer not null,
  total integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, challenge_date)
);

-- ── 7. add_xp() — call from the app via supabase.rpc('add_xp', …)
--     Adds XP + coins, logs the event, and maintains the streak.
create or replace function public.add_xp(amount integer, reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  update public.profiles p set
    xp = p.xp + amount,
    coins = p.coins + greatest(1, amount / 10),
    streak = case
      when p.last_study_date = current_date then p.streak
      when p.last_study_date = current_date - 1 then p.streak + 1
      else 1
    end,
    last_study_date = current_date
  where p.id = uid;

  insert into public.xp_events (user_id, amount, reason) values (uid, amount, reason);
end;
$$;

-- ── 8. seed_demo_data() — one-click sample content for a new user
create or replace function public.seed_demo_data()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s_math uuid; s_sci uuid;
  d1 uuid; q1 uuid; e1 uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  insert into public.subjects (user_id, name, icon, difficulty, total_lessons, completed_lessons)
  values (uid, 'Mathematics', '📐', 'Hard', 24, 15) returning id into s_math;
  insert into public.subjects (user_id, name, icon, difficulty, total_lessons, completed_lessons)
  values (uid, 'Science', '🧪', 'Medium', 18, 7) returning id into s_sci;
  insert into public.subjects (user_id, name, icon, difficulty, total_lessons, completed_lessons)
  values (uid, 'English', '📖', 'Easy', 15, 11);

  insert into public.flashcard_decks (user_id, subject_id, title)
  values (uid, s_sci, 'Cell Division Basics') returning id into d1;
  insert into public.flashcards (deck_id, front, back) values
    (d1, 'Phase where chromosomes align at the equator?', 'Metaphase'),
    (d1, 'Powerhouse of the cell?', 'Mitochondria'),
    (d1, 'Diploid number of human chromosomes?', '46'),
    (d1, 'Phase where the nuclear envelope breaks down?', 'Late prophase'),
    (d1, 'Structure that pulls chromatids apart?', 'Spindle fibers');

  insert into public.quizzes (user_id, subject_id, title, is_exam, duration_minutes)
  values (uid, s_math, 'Calculus: Limits & Derivatives', false, 10) returning id into q1;
  insert into public.questions (quiz_id, prompt, options, correct_index, explanation, topic) values
    (q1, 'What is the limit of (sin x)/x as x approaches 0?', '["0","1","Infinity","Does not exist"]', 1,
     'As x approaches 0, sin x is approximately x, so the ratio approaches 1 (Squeeze Theorem).', 'Limits'),
    (q1, 'The derivative of e^x is:', '["x·e^(x-1)","e^x · ln x","e^x","1/x"]', 2,
     'e^x is its own derivative — the defining property of the natural exponential.', 'Derivatives'),
    (q1, 'If f(x) = x³, the slope of the tangent at x = 2 is:', '["6","8","12","4"]', 2,
     'f''(x) = 3x², so f''(2) = 12.', 'Derivatives'),
    (q1, 'lim (x→∞) of 1/x equals:', '["1","0","Infinity","Undefined"]', 1,
     'As x grows without bound, 1/x shrinks toward 0.', 'Limits');

  insert into public.quizzes (user_id, subject_id, title, is_exam, duration_minutes, passing_percent)
  values (uid, s_math, 'Mock Board Exam — Set A', true, 5, 75) returning id into e1;
  insert into public.questions (quiz_id, prompt, options, correct_index, explanation, topic) values
    (e1, 'Which theorem guarantees a root of a continuous function that changes sign on [a,b]?', '["Mean Value Theorem","Intermediate Value Theorem","Rolle''s Theorem","Squeeze Theorem"]', 1, 'IVT: a continuous function takes every value between f(a) and f(b).', 'Continuity'),
    (e1, 'd/dx of ln(x) is:', '["1/x","ln x","x","e^x"]', 0, 'The derivative of the natural log is 1/x for x > 0.', 'Derivatives'),
    (e1, 'The integral of 2x dx is:', '["x² + C","2x² + C","x + C","2 + C"]', 0, 'Reverse the power rule: ∫2x dx = x² + C.', 'Integrals'),
    (e1, 'A function is continuous at a point if:', '["It is defined there","The limit exists there","Limit equals the function value","All of these"]', 3, 'Continuity requires all three conditions at once.', 'Continuity'),
    (e1, 'lim (x→0) (1 + x)^(1/x) =', '["1","0","e","Infinity"]', 2, 'This is the classic limit definition of e ≈ 2.718.', 'Limits');
end;
$$;

-- ── 9. ROW LEVEL SECURITY ────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.xp_events enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.daily_challenge_attempts enable row level security;

-- Profiles: everyone (logged in) can read (needed for leaderboard); only you can edit yours
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Simple owner-only tables
create policy "own subjects" on public.subjects
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own decks" on public.flashcard_decks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own quizzes" on public.quizzes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own attempts" on public.quiz_attempts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own challenge attempts" on public.daily_challenge_attempts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Child tables: access through the parent's owner
create policy "cards via own deck" on public.flashcards
  for all to authenticated
  using (exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.user_id = auth.uid()));
create policy "questions via own quiz" on public.questions
  for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid()));

-- XP events: readable by all (weekly leaderboard); inserted only via add_xp()
create policy "xp readable by authenticated" on public.xp_events
  for select to authenticated using (true);

-- Daily challenge: everyone can read; anyone can create today's set (first user of the day)
create policy "challenges readable" on public.daily_challenges
  for select to authenticated using (true);
create policy "challenges insertable" on public.daily_challenges
  for insert to authenticated with check (true);
