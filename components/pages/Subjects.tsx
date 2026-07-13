'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Subject } from '@/types'
import { Btn, Card, Empty, PageHeader, Pill, ProgressBar, Spinner } from '@/components/ui'

const toneFor = (d: Subject['difficulty']): 'green' | 'amber' | 'red' => (d === 'Easy' ? 'green' : d === 'Medium' ? 'amber' : 'red')

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📚')
  const [difficulty, setDifficulty] = useState<Subject['difficulty']>('Medium')

  async function load() {
    const { data } = await supabase.from('subjects').select('*').order('created_at')
    setSubjects((data as Subject[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!name.trim()) return
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('subjects').insert({ user_id: userData.user!.id, name, icon, difficulty, total_lessons: 10 })
    setName(''); setShowForm(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this subject? Its decks and quizzes stay but become unlinked.')) return
    await supabase.from('subjects').delete().eq('id', id)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div className="page-in">
      <PageHeader
        title="Subjects"
        sub={`${subjects.length} subject${subjects.length === 1 ? '' : 's'}`}
        action={<Btn onClick={() => setShowForm(v => !v)}><Plus size={16} /> New subject</Btn>}
      />

      {showForm && (
        <Card className="p-4 mb-5 flex gap-3 items-center flex-wrap">
          <input className="h-10 px-3 rounded-[10px] border border-slate-200 text-sm w-24" value={icon} onChange={e => setIcon(e.target.value)} placeholder="📚" />
          <input className="h-10 px-3 rounded-[10px] border border-slate-200 text-sm flex-1 min-w-40" value={name} onChange={e => setName(e.target.value)} placeholder="Subject name (e.g. Taxation)" />
          <select className="h-10 px-3 rounded-[10px] border border-slate-200 text-sm" value={difficulty} onChange={e => setDifficulty(e.target.value as Subject['difficulty'])}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
          <Btn onClick={create}>Create</Btn>
        </Card>
      )}

      {subjects.length === 0 ? (
        <Empty icon="📚" title="No subjects yet" sub="Create your first subject to get started." />
      ) : (
        <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4">
          {subjects.map(s => {
            const pct = s.total_lessons ? Math.round((s.completed_lessons / s.total_lessons) * 100) : 0
            return (
              <Card key={s.id} className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <span className="w-11 h-11 rounded-xl bg-primary-50 grid place-items-center text-xl">{s.icon}</span>
                  <Pill tone={toneFor(s.difficulty)}>{s.difficulty}</Pill>
                </div>
                <h3 className="font-semibold">{s.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{s.completed_lessons} of {s.total_lessons} lessons done</p>
                <ProgressBar value={pct} />
                <div className="flex justify-between items-center mt-3 text-xs text-slate-400">
                  <span>{pct}% complete</span>
                  <button onClick={() => remove(s.id)} className="hover:text-red-500" title="Delete subject"><Trash2 size={14} /></button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}