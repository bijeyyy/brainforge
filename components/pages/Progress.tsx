'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Attempt, Profile, XpEvent } from '@/types'
import { Card, Empty, PageHeader, Spinner } from '@/components/ui'

import { useProfile } from '@/components/AppShell'

export default function Progress() {
  const { profile } = useProfile()
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [events, setEvents] = useState<XpEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser()
      const [{ data: atts }, { data: xp }] = await Promise.all([
        supabase.from('quiz_attempts').select('*').order('created_at'),
        supabase.from('xp_events').select('*').eq('user_id', user.user!.id).order('created_at'),
      ])
      setAttempts((atts as Attempt[]) ?? [])
      setEvents((xp as XpEvent[]) ?? [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <Spinner />

  const totalQuestions = attempts.reduce((s, a) => s + a.total, 0)
  const totalCorrect = attempts.reduce((s, a) => s + a.score, 0)
  const avgAccuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0
  const last10 = attempts.slice(-10)

  // SVG accuracy trend over the last 10 attempts
  const points = last10.map((a, i) => {
    const x = last10.length === 1 ? 150 : (i / (last10.length - 1)) * 300
    const y = 90 - (a.score / a.total) * 80
    return `${x},${y}`
  }).join(' ')

  // Daily XP over the last 14 days
  const days: { label: string; xp: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    days.push({
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      xp: events.filter(e => e.created_at.slice(0, 10) === key).reduce((s, e) => s + e.amount, 0),
    })
  }
  const maxXp = Math.max(1, ...days.map(d => d.xp))

  const kpis = [
    { label: 'Total XP', value: (profile?.xp ?? 0).toLocaleString() },
    { label: 'Sessions', value: attempts.length },
    { label: 'Avg accuracy', value: `${avgAccuracy}%` },
    { label: 'Streak', value: `🔥 ${profile?.streak ?? 0}d` },
  ]

  return (
    <div className="page-in">
      <PageHeader title="Progress" sub="Trends matter more than any single score" />

      <div className="grid grid-cols-4 max-md:grid-cols-2 gap-3 mb-5">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</div>
            <div className="font-display text-xl font-semibold">{k.value}</div>
          </Card>
        ))}
      </div>

      {attempts.length === 0 ? (
        <Empty icon="📈" title="No data yet" sub="Take a few quizzes and your trends will appear here." />
      ) : (
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Accuracy — last {last10.length} sessions</h3>
            <svg viewBox="0 0 300 100" className="w-full">
              <line x1="0" y1="90" x2="300" y2="90" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="0" y1="10" x2="300" y2="10" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
              {last10.length > 1 && <polyline points={points} fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
              {last10.map((a, i) => {
                const x = last10.length === 1 ? 150 : (i / (last10.length - 1)) * 300
                const y = 90 - (a.score / a.total) * 80
                return <circle key={i} cx={x} cy={y} r="3.5" fill="#4F46E5" />
              })}
            </svg>
            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>oldest</span><span>latest</span></div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">XP — last 14 days</h3>
            <div className="flex items-end gap-1.5 h-28">
              {days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.xp} XP`}>
                  <div className="w-full rounded-t-md bg-primary/80 transition-all" style={{ height: `${(d.xp / maxXp) * 100}%`, minHeight: d.xp ? 4 : 1, opacity: d.xp ? 1 : 0.2 }} />
                  <span className="text-[10px] text-slate-400">{d.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 col-span-2 max-md:col-span-1">
            <h3 className="font-semibold mb-3">Session history</h3>
            <div className="divide-y divide-slate-100">
              {attempts.slice().reverse().slice(0, 8).map(a => {
                const pct = Math.round((a.score / a.total) * 100)
                return (
                  <div key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="capitalize font-medium w-24">{a.mode}</span>
                    <span className="flex-1 text-slate-500">{new Date(a.created_at).toLocaleString()}</span>
                    <span className="text-slate-500">{a.score}/{a.total}</span>
                    <span className={`font-semibold w-12 text-right ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
