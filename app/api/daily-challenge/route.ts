import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force this route to run at request time only — never touched during
// Next.js's build-time "collect page data" step.
export const dynamic = 'force-dynamic'

// Wide pool of categories — AI picks a random mix each day so it never feels repetitive
const CATEGORIES = [
  'general math', 'science trivia', 'world history', 'Philippine history',
  'grammar and vocabulary', 'logical reasoning', 'geography', 'current general knowledge',
  'basic economics', 'literature', 'technology', 'health and biology',
]

export async function POST(req: NextRequest) {
  try {
    // ⬇️ Clients are created HERE, inside the handler, not at module scope.
    // This means they only run when a real request comes in (runtime),
    // never during the build's static analysis pass — so a missing/late
    // env var can no longer crash the whole build.
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Server misconfigured: missing GROQ_API_KEY.' }, { status: 500 })
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server misconfigured: missing Supabase env vars.' }, { status: 500 })
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { todayISO } = await req.json()

    // Shared set for the day — everyone gets the same 5 questions (for the leaderboard to make sense)
    const { data: existing } = await supabase.from('daily_challenges')
      .select('questions').eq('challenge_date', todayISO).maybeSingle()
    if (existing) return NextResponse.json({ questions: existing.questions })

    // Randomize which categories get used today
    const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5).slice(0, 5)

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Generate 5 multiple-choice trivia/quiz questions, one each from these topics: ${shuffled.join(', ')}.
Mix of easy and medium difficulty, suitable for a general student audience.
Return ONLY valid JSON, an array of 5 objects with fields: prompt, options (array of 4 strings), correct_index (0-3). No markdown, no preamble, no explanation.`,
      }],
      max_tokens: 1200,
    })

    const text = completion.choices[0]?.message?.content ?? ''
    if (!text) {
      return NextResponse.json({ error: 'AI returned an empty response.' }, { status: 500 })
    }

    let questions
    try {
      questions = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      console.error('daily-challenge: failed to parse AI response:', text)
      return NextResponse.json({ error: 'AI returned malformed JSON.' }, { status: 500 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('daily_challenges')
      .insert({ challenge_date: todayISO, questions })
      .select('questions')
      .single()

    if (insertError) {
      // Baka may ibang request na naka-insert na habang tayo nag-ge-generate (race condition)
      const { data: retryExisting } = await supabase
        .from('daily_challenges')
        .select('questions')
        .eq('challenge_date', todayISO)
        .maybeSingle()

      if (retryExisting) return NextResponse.json({ questions: retryExisting.questions })

      console.error('daily-challenge: insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ questions: inserted.questions })
  } catch (err) {
    console.error('daily-challenge error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate daily challenge.' }, { status: 500 })
  }
}