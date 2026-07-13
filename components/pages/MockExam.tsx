'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag, Pencil, Plus, Trash2 } from 'lucide-react'
import QuizBuilder from '@/components/QuizBuilder'
import { supabase } from '@/lib/supabase'
import { addXp } from '@/lib/api'
import { Question, Quiz } from '@/types'
import { Btn, Card, Empty, PageHeader, Pill, Spinner } from '@/components/ui'

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

import { useProfile } from '@/components/AppShell'

export default function MockExam() {
  const { refreshProfile } = useProfile()
  const [exams, setExams] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [flags, setFlags] = useState<Set<number>>(new Set())
  const [seconds, setSeconds] = useState(0)
  const [finished, setFinished] = useState(false)
  const timerRef = useRef<number | null>(null)

  async function loadExams() {
    const { data } = await supabase.from('quizzes').select('*, questions(count)').eq('is_exam', true).order('created_at')
    setExams((data as Quiz[]) ?? []); setLoading(false)
  }
  useEffect(() => {
    loadExams()
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [])

  // ── Create + build your own exam ──
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDuration, setNewDuration] = useState(30)
  const [newPassing, setNewPassing] = useState(75)
  const [building, setBuilding] = useState<Quiz | null>(null)

  async function createExam() {
    if (!newTitle.trim()) return
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('quizzes').insert({
      user_id: u.user!.id, title: newTitle.trim(), is_exam: true,
      duration_minutes: Math.max(1, newDuration), passing_percent: Math.min(100, Math.max(1, newPassing)),
    }).select().single()
    if (error) { alert('Could not create exam: ' + error.message); return }
    setNewTitle(''); setShowNew(false)
    await loadExams()
    setBuilding(data as Quiz)
  }

  async function deleteExam(exam: Quiz) {
  if (!confirm(`Delete "${exam.title}"? This will also delete all its questions and attempt history. This cannot be undone.`)) return
  const { error } = await supabase.from('quizzes').delete().eq('id', exam.id)
  if (error) { alert('Could not delete exam: ' + error.message); return }
  setExams(es => es.filter(e => e.id !== exam.id))
}

  async function start(exam: Quiz) {
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', exam.id)
    setQuestions((data as Question[]) ?? [])
    setActive(exam); setIndex(0); setAnswers({}); setFlags(new Set()); setFinished(false)
    setSeconds(exam.duration_minutes * 60)
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { window.clearInterval(timerRef.current!); submitRef.current(); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const submitRef = useRef(() => { })
  submitRef.current = async () => {
    if (finished || !active) return
    if (timerRef.current) window.clearInterval(timerRef.current)
    const score = questions.reduce((s, q, i) => s + (answers[i] === q.correct_index ? 1 : 0), 0)
    await supabase.from('quiz_attempts').insert({
      user_id: (await supabase.auth.getUser()).data.user!.id,
      quiz_id: active.id, mode: 'exam', score, total: questions.length,
      duration_seconds: active.duration_minutes * 60 - seconds,
    })
    await addXp(score * 8, `Mock exam: ${active.title}`)
    refreshProfile()
    setFinished(true)
  }

  function submit() {
    const unanswered = questions.length - Object.keys(answers).length
    if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return
    submitRef.current()
  }

  if (loading) return <Spinner />

  // ── Question builder ──
  if (building) {
    return <QuizBuilder quizId={building.id} title={building.title} onBack={() => { setBuilding(null); loadExams() }} />
  }

  // ── Results with per-topic breakdown ──
  if (active && finished) {
    const score = questions.reduce((s, q, i) => s + (answers[i] === q.correct_index ? 1 : 0), 0)
    const pct = Math.round((score / questions.length) * 100)
    const passed = pct >= active.passing_percent
    const topics = new Map<string, { right: number; total: number }>()
    questions.forEach((q, i) => {
      const t = q.topic ?? 'General'
      const e = topics.get(t) ?? { right: 0, total: 0 }
      e.total++; if (answers[i] === q.correct_index) e.right++
      topics.set(t, e)
    })
    return (
      <div className="page-in max-w-xl mx-auto">
        <Card className="p-8 text-center mb-4">
          <div className="text-5xl mb-3">{passed ? '🏆' : '📚'}</div>
          <h2 className="text-3xl font-semibold">{pct}%</h2>
          <Pill tone={passed ? 'green' : 'red'}>{passed ? 'PASSED' : 'FAILED'} · needs {active.passing_percent}%</Pill>
          <p className="text-sm text-slate-500 mt-2">{score} of {questions.length} correct · +{score * 8} XP</p>
        </Card>
        <Card className="p-5 mb-4">
          <h3 className="font-semibold mb-3">Per-topic breakdown</h3>
          {[...topics.entries()].sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total).map(([t, v]) => {
            const p = Math.round((v.right / v.total) * 100)
            return (
              <div key={t} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1">{t}</span>
                <div className="w-40 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${p}%`, background: p >= 70 ? '#22C55E' : p >= 40 ? '#F59E0B' : '#EF4444' }} />
                </div>
                <span className="w-16 text-right text-slate-500">{v.right}/{v.total}</span>
              </div>
            )
          })}
        </Card>
        <div className="flex gap-2 justify-center">
          <Btn variant="ghost" onClick={() => setActive(null)}>Back to exams</Btn>
          <Btn onClick={() => start(active)}>Retake exam</Btn>
        </div>
      </div>
    )
  }

  // ── Exam mode ──
  if (active) {
    const q = questions[index]
    if (!q) return <Empty icon="📝" title="This exam has no questions" sub="Add questions in Supabase." action={<Btn onClick={() => setActive(null)}>Back</Btn>} />
    const low = seconds < active.duration_minutes * 60 * 0.1
    const mid = seconds < active.duration_minutes * 60 * 0.25
    return (
      <div className="page-in">
        <div className="flex items-center gap-4 mb-5 flex-wrap">
          <h2 className="font-semibold">{active.title}</h2>
          <span className="text-xs text-slate-400">Autosaves as you answer</span>
          <span className={`ml-auto font-display font-semibold tabular-nums px-3 py-1 rounded-full border text-sm
            ${low ? 'text-red-600 border-red-200 animate-pulse' : mid ? 'text-amber-600 border-amber-200' : 'border-slate-200'}`}>
            ⏱ {fmt(seconds)}
          </span>
          <Btn variant="danger" onClick={submit}>Submit exam</Btn>
        </div>

        <div className="grid grid-cols-[1fr_240px] max-md:grid-cols-1 gap-4">
          <Card className="p-7">
            <div className="flex justify-between items-start">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Question {index + 1}</div>
              <button onClick={() => setFlags(f => { const n = new Set(f); n.has(index) ? n.delete(index) : n.add(index); return n })}
                className={flags.has(index) ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'}>
                <Flag size={18} fill={flags.has(index) ? 'currentColor' : 'none'} />
              </button>
            </div>
            <h2 className="text-lg font-semibold my-4 leading-relaxed">{q.prompt}</h2>
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => setAnswers(a => ({ ...a, [index]: i }))}
                className={`flex items-center gap-3 w-full text-left border-[1.5px] rounded-xl px-4 py-3.5 text-sm mb-2.5 transition
                  ${answers[index] === i ? 'border-primary bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className={`w-6 h-6 rounded-md border grid place-items-center text-xs font-semibold shrink-0
                  ${answers[index] === i ? 'bg-primary border-primary text-white' : 'border-slate-300'}`}>{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            ))}
            <div className="flex justify-between mt-4">
              <Btn variant="ghost" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}>← Previous</Btn>
              <Btn onClick={() => setIndex(i => Math.min(questions.length - 1, i + 1))} disabled={index === questions.length - 1}>Next →</Btn>
            </div>
          </Card>

          {/* Question palette */}
          <Card className="p-4 h-fit">
            <h3 className="text-sm font-semibold mb-3">Question palette</h3>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((_, i) => {
                const answered = answers[i] !== undefined
                const flagged = flags.has(i)
                return (
                  <button key={i} onClick={() => setIndex(i)}
                    className={`h-8 rounded-lg text-xs font-semibold border transition
                      ${i === index ? 'ring-2 ring-primary ring-offset-1 ' : ''}
                      ${flagged ? 'bg-amber-100 border-amber-300 text-amber-700'
                        : answered ? 'bg-primary border-primary text-white'
                          : 'bg-white border-slate-200 text-slate-500'}`}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="text-xs text-slate-500 mt-3 space-y-1">
              <div>{Object.keys(answers).length} answered · {flags.size} flagged</div>
              <div>{questions.length - Object.keys(answers).length} remaining</div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // ── Library ──
  return (
    <div className="page-in">
      <PageHeader
        title="Mock Exams" sub="Real exam simulation — timed, no feedback until you submit"
        action={<Btn onClick={() => setShowNew(v => !v)}><Plus size={16} /> New exam</Btn>}
      />
      {showNew && (
        <Card className="p-4 mb-5 flex gap-3 items-center flex-wrap">
          <input
            className="h-10 px-3.5 rounded-[10px] border border-slate-200 text-sm flex-1 min-w-48 outline-none focus:ring-2 focus:ring-primary transition"
            placeholder="Exam title (e.g. CPA Mock Board — Set B)"
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-sm text-slate-500">
            <input type="number" min={1} className="h-10 w-20 px-3 rounded-[10px] border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={newDuration} onChange={e => setNewDuration(Number(e.target.value))} /> min
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-500">
            pass at <input type="number" min={1} max={100} className="h-10 w-20 px-3 rounded-[10px] border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={newPassing} onChange={e => setNewPassing(Number(e.target.value))} /> %
          </label>
          <Btn onClick={createExam}>Create exam</Btn>
        </Card>
      )}
      {exams.length === 0 ? (
        <Empty icon="📝" title="No mock exams yet" sub="Click New exam above to build your own." />
      ) : (
        <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4">
          {exams.map(e => (
            <Card key={e.id} className="p-5">
              <div className="w-11 h-11 rounded-xl bg-red-50 grid place-items-center text-xl mb-3">📝</div>
              <h3 className="font-semibold">{e.title}</h3>
              <p className="text-xs text-slate-500 mb-3">{e.questions?.[0]?.count ?? 0} items · {e.duration_minutes} min · pass at {e.passing_percent}%</p>
              <div className="flex gap-2">
                <Btn className="flex-1" onClick={() => start(e)} disabled={(e.questions?.[0]?.count ?? 0) === 0}>Start exam →</Btn>
                <Btn variant="ghost" onClick={() => setBuilding(e)} title="Add or edit questions"><Pencil size={15} /></Btn>
                <Btn variant="ghost" onClick={() => deleteExam(e)} title="Delete exam" className="text-slate-300 hover:text-red-500">
                  <Trash2 size={15} />
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}