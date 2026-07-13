import { supabase } from './supabase'

/** Award XP (also updates coins + streak, and logs an xp_event) */
export async function addXp(amount: number, reason: string) {
  const { error } = await supabase.rpc('add_xp', { amount, reason })
  if (error) console.error('add_xp failed:', error.message)
}

export const levelFromXp = (xp: number) => Math.floor(xp / 500) + 1
export const levelProgress = (xp: number) => Math.round(((xp % 500) / 500) * 100)

export const todayISO = () => new Date().toISOString().slice(0, 10)

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date(todayISO()).getTime()
  return Math.ceil(diff / 86_400_000)
}


export async function saveGeneratedQuiz(
  title: string,
  questions: { prompt: string; options: string[]; correct_index: number; explanation: string; topic?: string }[],
  opts?: { duration_minutes?: number; passing_percent?: number }
) {
  const { data: quiz, error: qErr } = await supabase
    .from('quizzes')
    .insert({
      title,
      subject_id: null,
      is_exam: false,
      duration_minutes: opts?.duration_minutes ?? 10,
      passing_percent: opts?.passing_percent ?? 70,
    })
    .select()
    .single()
  if (qErr) throw qErr

  const rows = questions.map(q => ({
    quiz_id: quiz.id,
    prompt: q.prompt,
    options: q.options,
    correct_index: q.correct_index,
    explanation: q.explanation,
    topic: q.topic ?? null,
  }))
  const { error: insErr } = await supabase.from('questions').insert(rows)
  if (insErr) throw insErr

  await addXp(10, 'ai_generate_quiz')
  return { id: quiz.id, title: quiz.title, count: rows.length }
}

export async function saveGeneratedFlashcards(title: string, cards: { front: string; back: string }[]) {
  const { data: deck, error: dErr } = await supabase
    .from('decks')
    .insert({ subject_id: null, title })
    .select()
    .single()
  if (dErr) throw dErr

  const rows = cards.map(c => ({
    deck_id: deck.id,
    front: c.front,
    back: c.back,
    interval_days: 1,
    due_date: todayISO(),
    is_favorite: false,
  }))
  const { error: insErr } = await supabase.from('flashcards').insert(rows)
  if (insErr) throw insErr

  await addXp(10, 'ai_generate_flashcards')
  return { id: deck.id, title: deck.title, count: rows.length }
}

export async function saveGeneratedReviewer(title: string, content: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Kailangan naka-login ka para makagawa ng reviewer')

  const { data: reviewer, error: rErr } = await supabase
    .from('reviewers')
    .insert({ user_id: user.id, title, content })
    .select()
    .single()
  if (rErr) throw rErr

  await addXp(10, 'ai_generate_reviewer')
  return { id: reviewer.id, title: reviewer.title }
}