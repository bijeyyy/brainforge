'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HelpCircle, Layers, Sparkles, FileText, Flame } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { addXp, daysUntil, levelFromXp, levelProgress, todayISO } from '@/lib/api'
import { Attempt, Profile, Subject } from '@/types'
import { Btn, Card, Empty, PageHeader, Pill, ProgressBar, Spinner } from '@/components/ui'

import { useProfile } from '@/components/AppShell'

export default function Dashboard() {
  const { profile, refreshProfile } = useProfile()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [xpToday, setXpToday] = useState(0)
  const [dueCards, setDueCards] = useState(0)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [{ data: subs }, { data: atts }, { data: xp }, { count }] = await Promise.all([
      supabase.from('subjects').select('*').order('created_at'),
      supabase.from('quiz_attempts').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('xp_events').select('amount, created_at').gte('created_at', todayISO()),
      supabase.from('flashcards').select('id', { count: 'exact', head: true }).lte('due_date', todayISO()),
    ])
    setSubjects((subs as Subject[]) ?? [])
    setAttempts((atts as Attempt[]) ?? [])
    setXpToday(((xp as { amount: number }[]) ?? []).reduce((s, e) => s + e.amount, 0))
    setDueCards(count ?? 0)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <Spinner />

  const days = daysUntil(profile?.exam_date ?? null)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const quickActions = [
    { to: '/quizzes', icon: HelpCircle, label: 'New Quiz', sub: 'Test yourself', tint: 'bg-primary-50 text-primary' },
    { to: '/flashcards', icon: Layers, label: 'Flashcards', sub: `${dueCards} due today`, tint: 'bg-amber-50 text-amber-600' },
    { to: '/assistant', icon: Sparkles, label: 'Ask AI', sub: 'Get help fast', tint: 'bg-accent-50 text-accent' },
    { to: '/mock-exam', icon: FileText, label: 'Mock Exam', sub: 'Full simulation', tint: 'bg-red-50 text-red-600' },
  ]

  return (
    <div className="page-in">
      <PageHeader
        title={`${greeting}, ${profile?.full_name?.split(' ')[0] ?? 'Learner'} 👋`}
        sub={days !== null
          ? <>Your {profile?.exam_name ?? 'exam'} is in <b className="text-primary">{days} days</b></>
          : 'Set your exam date in your profile to see a countdown.'}
      />

      {/* Stat strip */}
      <div className="grid grid-cols-4 max-md:grid-cols-2 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Streak</div>
          <div className="font-display text-xl font-semibold flex items-center gap-1.5"><Flame size={18} className="text-amber-500" />{profile?.streak ?? 0} days</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">XP Today</div>
          <div className="font-display text-xl font-semibold text-green-600">+{xpToday} XP</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Level</div>
          <div className="font-display text-xl font-semibold">Lv {levelFromXp(profile?.xp ?? 0)}</div>
          <ProgressBar value={levelProgress(profile?.xp ?? 0)} className="mt-2" />
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Coins</div>
          <div className="font-display text-xl font-semibold">🪙 {profile?.coins ?? 0}</div>
        </Card>
      </div>

      {subjects.length === 0 ? (
        <Empty
          icon="🚀" title="Welcome to BrainForge!"
          sub="Start by creating your first subject - everything else (flashcards, quizzes, reviewers) build from there."
          action={<Link href="/subjects"><Btn>Create your first subject</Btn></Link>} 
        />
      ) : (
        <>
          {/* Quick actions */}
          <div className="grid grid-cols-4 max-md:grid-cols-2 gap-3 mb-8">
            {quickActions.map(a => (
              <Link key={a.label} href={a.to}>
                <Card className="p-4 h-full" onClick={() => {}}>
                  <div className={`w-9 h-9 rounded-[10px] grid place-items-center mb-2.5 ${a.tint}`}><a.icon size={18} /></div>
                  <div className="text-sm font-semibold">{a.label}</div>
                  <div className="text-xs text-slate-500">{a.sub}</div>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
            {/* Subjects */}
            <Card className="p-5 col-span-2 max-md:col-span-1">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">My subjects</h3>
                <Link href="/subjects" className="text-sm text-primary font-semibold">View all →</Link>
              </div>
              {subjects.slice(0, 4).map(s => {
                const pct = s.total_lessons ? Math.round((s.completed_lessons / s.total_lessons) * 100) : 0
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                    <span className="text-xl">{s.icon}</span>
                    <span className="flex-1 text-sm font-medium">{s.name}</span>
                    <ProgressBar value={pct} className="w-32 max-md:w-20" />
                    <span className="text-xs text-slate-500 w-9 text-right">{pct}%</span>
                  </div>
                )
              })}
            </Card>

            {/* Recent sessions */}
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Recent sessions</h3>
              {attempts.length === 0 && <p className="text-sm text-slate-500">No sessions yet — take your first quiz!</p>}
              {attempts.map(a => {
                const pct = Math.round((a.score / a.total) * 100)
                return (
                  <div key={a.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0 text-sm">
                    <span className="flex-1 capitalize font-medium">{a.mode}</span>
                    <Pill tone={pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'red'}>{pct}%</Pill>
                  </div>
                )
              })}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}