export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  xp: number
  coins: number
  streak: number
  last_study_date: string | null
  exam_name: string | null
  exam_date: string | null
}

export interface Subject {
  id: string
  user_id: string
  name: string
  icon: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  total_lessons: number
  completed_lessons: number
}

export interface Deck {
  id: string
  subject_id: string | null
  title: string
  flashcards?: { count: number }[]
}

export interface Flashcard {
  id: string
  deck_id: string
  front: string
  back: string
  interval_days: number
  due_date: string
  is_favorite: boolean
}

export interface Quiz {
  id: string
  subject_id: string | null
  title: string
  is_exam: boolean
  duration_minutes: number
  passing_percent: number
  questions?: { count: number }[]
}

export interface Question {
  id: string
  quiz_id: string
  prompt: string
  options: string[]
  correct_index: number
  explanation: string | null
  topic: string | null
}

export interface Attempt {
  id: string
  quiz_id: string | null
  mode: 'quiz' | 'exam' | 'challenge'
  score: number
  total: number
  duration_seconds: number
  created_at: string
}

export interface XpEvent {
  user_id: string
  amount: number
  reason: string
  created_at: string
}

export interface ChallengeQuestion {
  prompt: string
  options: string[]
  correct_index: number
}

export type Reviewer = {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
}