'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { levelFromXp } from '@/lib/api'
import { Profile, XpEvent } from '@/types'
import { Card, PageHeader, Pill, Spinner } from '@/components/ui'

type Row = { id: string; name: string; xp: number }

import { useProfile } from '@/components/AppShell'

export default function Leaderboard() {
  const { profile } = useProfile()
  const [tab, setTab] = useState<'weekly' | 'alltime'>('weekly')
  const [allTime, setAllTime] = useState<Row[]>([])
  const [weekly, setWeekly] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      // All-time: total XP straight from profiles
      const { data: profs } = await supabase.from('profiles')
        .select('id, username, full_name, xp').order('xp', { ascending: false }).limit(50)
      setAllTime(((profs ?? []) as { id: string; username: string | null; full_name: string | null; xp: number }[])
        .map(p => ({ id: p.id, name: p.username ?? p.full_name ?? 'Learner', xp: p.xp })))

      // Weekly: aggregate the last 7 days of xp_events client-side
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const { data: events } = await supabase.from('xp_events')
        .select('user_id, amount, created_at, reason').gte('created_at', since)
      const sums = new Map<string, number>()
      ;((events ?? []) as XpEvent[]).forEach(e => sums.set(e.user_id, (sums.get(e.user_id) ?? 0) + e.amount))
      const nameOf = new Map((profs ?? []).map((p: { id: string; username: string | null; full_name: string | null }) => [p.id, p.username ?? p.full_name ?? 'Learner']))
      setWeekly([...sums.entries()]
        .map(([id, xp]) => ({ id, name: nameOf.get(id) ?? 'Learner', xp }))
        .sort((a, b) => b.xp - a.xp).slice(0, 50))
      setLoading(false)
    })()
  }, [])

  if (loading) return <Spinner />

  const rows = tab === 'weekly' ? weekly : allTime
  const myRank = rows.findIndex(r => r.id === profile?.id)
  const medal = ['🥇', '🥈', '🥉']

  return (
    <div className="page-in max-w-2xl mx-auto">
      <PageHeader title="Leaderboard" sub="Compete on consistency — weekly XP resets every 7 days" />

      <div className="flex gap-2 mb-4">
        {(['weekly', 'alltime'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`h-9 px-4 rounded-full text-sm font-semibold transition
              ${tab === t ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'}`}>
            {t === 'weekly' ? 'This week' : 'All time'}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-slate-100">
        {rows.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">No XP earned yet this period — be the first!</p>}
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-3 px-5 py-3.5 text-sm ${r.id === profile?.id ? 'bg-primary-50' : ''}`}>
            <span className="w-8 font-display font-semibold text-slate-400">{medal[i] ?? `#${i + 1}`}</span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-red-400 grid place-items-center text-white text-xs font-semibold">
              {r.name[0]}
            </div>
            <span className="flex-1 font-medium">{r.name}{r.id === profile?.id && <span className="text-primary"> (you)</span>}</span>
            <Pill tone="indigo">Lv {levelFromXp(tab === 'alltime' ? r.xp : (allTime.find(a => a.id === r.id)?.xp ?? r.xp))}</Pill>
            <span className="w-20 text-right font-display font-semibold">{r.xp.toLocaleString()} XP</span>
          </div>
        ))}
      </Card>

      {myRank === -1 && rows.length > 0 && (
        <p className="text-xs text-slate-400 text-center mt-3">Earn XP this period to appear on the board.</p>
      )}
    </div>
  )
}
