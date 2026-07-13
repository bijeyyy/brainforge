'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { addXp, todayISO } from '@/lib/api'
import { ChallengeQuestion } from '@/types'
import { Btn, Card, Pill, Spinner } from '@/components/ui'
import { useProfile } from '@/components/AppShell'

export default function DailyChallenge() {
  const { refreshProfile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([])
  const [attempted, setAttempted] = useState<{ score: number; total: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const today = todayISO()
        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError || !userData?.user) {
          console.error('No authenticated user:', userError)
          setLoading(false)
          return
        }

        const userId = userData.user.id

        // Already played today?
        const { data: att, error: attError } = await supabase.from('daily_challenge_attempts')
          .select('score, total').eq('user_id', userId).eq('challenge_date', today).maybeSingle()

        if (attError) console.error('Error checking attempt:', attError)
        if (att) setAttempted(att as { score: number; total: number })

        // Fetch (or generate) today's shared AI question set
        const res = await fetch('/api/daily-challenge', {
          method: 'POST',
          body: JSON.stringify({ todayISO: today }),
        })
        const data = await res.json()

        console.log('daily-challenge API response:', data) // TEMP: para makita natin sa console

        if (!res.ok || !Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error(data.error || 'Failed to load challenge')
        }

        setQuestions(data.questions)
      } catch (err) {
        console.error('Failed to load daily challenge:', err)
        setQuestions([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function pick(i: number) {
    if (picked !== null) return
    setPicked(i)
    if (i === questions[index].correct_index) setScore(s => s + 1)
    setTimeout(async () => {
      if (index + 1 < questions.length) { setIndex(x => x + 1); setPicked(null) }
      else {
        const finalScore = score + (i === questions[index].correct_index ? 1 : 0)
        const { data: user } = await supabase.auth.getUser()
        await supabase.from('daily_challenge_attempts').insert({
          user_id: user.user!.id, challenge_date: todayISO(), score: finalScore, total: questions.length,
        })
        await addXp(finalScore === questions.length ? 50 : finalScore * 8, 'Daily challenge')
        refreshProfile()
        setDone(true)
      }
    }, 800)
  }

  if (loading) return <Spinner />

  if (attempted && !playing) {
    return (
      <div className="page-in max-w-md mx-auto text-center pt-16">
        <Card className="p-8">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-semibold mb-1">Challenge complete!</h2>
          <p className="text-sm text-slate-500">You scored <b>{attempted.score}/{attempted.total}</b> today. Come back tomorrow for a new set.</p>
        </Card>
      </div>
    )
  }

  if (done) {
    return (
      <div className="page-in max-w-md mx-auto text-center pt-16">
        <Card className="p-8">
          <div className="text-5xl mb-3">{score === questions.length ? '🏆' : '⚡'}</div>
          <h2 className="text-xl font-semibold mb-1">{score}/{questions.length}</h2>
          <p className="text-sm text-slate-500">+{score === questions.length ? 50 : score * 8} XP earned. Same set for everyone — check the leaderboard!</p>
        </Card>
      </div>
    )
  }

  if (playing) {
    const q = questions[index]
    if (!q) return <Spinner />
    return (
      <div className="page-in max-w-xl mx-auto pt-6">
        <div className="flex justify-between text-sm text-slate-500 mb-3">
          <span>Question {index + 1} / {questions.length}</span>
          <Pill tone="amber">⚡ Daily Challenge</Pill>
        </div>
        <Card className="p-7">
          <h2 className="text-lg font-semibold mb-5">{q.prompt}</h2>
          {q.options.map((opt, i) => {
            let cls = 'border-slate-200 hover:bg-slate-50'
            if (picked !== null) {
              if (i === q.correct_index) cls = 'border-green-500 bg-green-50 pop'
              else if (i === picked) cls = 'border-red-500 bg-red-50 shake'
              else cls = 'opacity-60 border-slate-200'
            }
            return (
              <button key={i} onClick={() => pick(i)} disabled={picked !== null}
                className={`block w-full text-left border-[1.5px] rounded-xl px-4 py-3.5 text-sm mb-2.5 transition ${cls}`}>
                {opt}
              </button>
            )
          })}
        </Card>
      </div>
    )
  }

  return (
    <div className="page-in max-w-md mx-auto text-center pt-14">
      <Card className="p-8">
        <div className="text-5xl mb-3">⚡</div>
        <h1 className="text-2xl font-semibold mb-1">Today's Challenge</h1>
        <p className="text-sm text-slate-500 mb-5">
          5 questions · everyone gets the same set<br />
          Perfect score = <b>+50 XP</b>
        </p>
        <Btn onClick={() => setPlaying(true)}>Start challenge</Btn>
      </Card>
    </div>
  )
}