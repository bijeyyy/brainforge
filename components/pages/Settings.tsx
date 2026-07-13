'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/components/AppShell'
import { Btn, Card, PageHeader } from '@/components/ui'

export default function Settings() {
  const { profile, refreshProfile } = useProfile()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [examName, setExamName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? '')
      setFullName(profile.full_name ?? '')
      setExamName(profile.exam_name ?? '')
      setExamDate(profile.exam_date ?? '')
    }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [profile])

  async function save() {
    if (!profile) return
    setSaving(true); setMsg(null)
    // usernames: lowercase, no spaces — keeps the leaderboard clean
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '')
    const { error } = await supabase.from('profiles').update({
      username: cleanUsername || null,
      full_name: fullName.trim() || null,
      exam_name: examName.trim() || null,
      exam_date: examDate || null,
    }).eq('id', profile.id)

    if (error) {
      setMsg({ ok: false, text: error.code === '23505' ? 'That username is already taken — try another.' : error.message })
    } else {
      setUsername(cleanUsername)
      setMsg({ ok: true, text: 'Profile saved ✓' })
      refreshProfile()
    }
    setSaving(false)
  }

  const input = 'w-full h-10 px-3.5 rounded-[10px] border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary transition'
  const label = 'block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5'

  return (
    <div className="page-in max-w-xl mx-auto">
      <PageHeader title="Settings" sub="Edit your profile — your username is what appears on the leaderboard" />

      <Card className="p-6 space-y-5">
        <div>
          <label className={label}>Email (from your account — can&apos;t be changed here)</label>
          <input className={`${input} opacity-60 cursor-not-allowed`} value={email} disabled />
        </div>

        <div>
          <label className={label}>Username · shown on the leaderboard</label>
          <input className={input} placeholder="e.g. bobjohn_dev" value={username} onChange={e => setUsername(e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers, dots, dashes, underscores. Must be unique.</p>
        </div>

        <div>
          <label className={label}>Full name · used in greetings</label>
          <input className={input} placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
          <div>
            <label className={label}>Target exam name</label>
            <input className={input} placeholder="e.g. CPA Board Exam" value={examName} onChange={e => setExamName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Exam date · powers the dashboard countdown</label>
            <input className={input} type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
          </div>
        </div>

        {msg && <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>}

        <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Btn>
      </Card>
    </div>
  )
}
