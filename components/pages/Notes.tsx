'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Star, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Note } from '@/types'
import { Btn, Card, Empty, PageHeader, Pill, Spinner } from '@/components/ui'
import RichTextEditor from '@/components/RichTextEditor'

// Strips HTML tags for use in the card preview / plain-text contexts
function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [activeNote, setActiveNote] = useState<Note | null>(null)

  const [showNewNote, setShowNewNote] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotes((data as Note[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { loadNotes() }, [])

  async function createNote() {
    if (!newTitle.trim()) return
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('notes')
      .insert({ user_id: u.user!.id, title: newTitle.trim(), content: '' })
      .select().single()
    if (error) { alert('Could not create note: ' + error.message); return }
    setNewTitle(''); setShowNewNote(false)
    await loadNotes()
    openEditor(data as Note)
  }

  function openEditor(note: Note) {
    setTitle(note.title)
    setContent(note.content ?? '')
    setActiveNote(note)
  }

  async function saveNote() {
    if (!activeNote) return
    if (!title.trim()) { alert('Give your note a title.'); return }
    setSaving(true)
    const { error } = await supabase.from('notes')
      .update({ title: title.trim(), content })
      .eq('id', activeNote.id)
    setSaving(false)
    if (error) { alert('Could not save note: ' + error.message); return }
    setActiveNote(null)
    loadNotes()
  }

  async function deleteNote(note: Note) {
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('notes').delete().eq('id', note.id)
    if (error) { alert('Could not delete note: ' + error.message); return }
    setNotes(ns => ns.filter(n => n.id !== note.id))
    if (activeNote?.id === note.id) setActiveNote(null)
  }

  async function togglePin(note: Note) {
    await supabase.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id)
    setNotes(ns => ns.map(n => (n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n)))
  }

  if (loading) return <Spinner />

  const inputCls = 'w-full h-10 px-3.5 rounded-[10px] border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary transition'

  // ── Note editor ──
  if (activeNote) {
    return (
      <div className="page-in max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setActiveNote(null)} className="text-sm text-slate-500 hover:text-slate-900">← Back</button>
          <h1 className="text-xl font-semibold flex-1 truncate">{activeNote.title}</h1>
          <button onClick={() => togglePin(activeNote)} title={activeNote.is_pinned ? 'Unpin note' : 'Pin note'}>
            <Star size={18} className={activeNote.is_pinned ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
          </button>
        </div>

        <Card className="p-5 mb-5">
          <div className="space-y-2.5">
            <input
              className={`${inputCls} font-semibold`}
              placeholder="Note title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <RichTextEditor content={content} onChange={setContent} placeholder="Write something..." />
          </div>
        </Card>

        <div className="flex gap-2 justify-end">
          <Btn variant="ghost" onClick={() => deleteNote(activeNote)} className="text-slate-400 hover:text-red-500">
            <Trash2 size={15} /> Delete
          </Btn>
          <Btn onClick={saveNote} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</Btn>
        </div>
      </div>
    )
  }

  // ── Notes library ──
  return (
    <div className="page-in">
      <PageHeader
        title="Notes"
        sub={`${notes.length} note${notes.length === 1 ? '' : 's'}`}
        action={<Btn onClick={() => setShowNewNote(v => !v)}><Plus size={16} /> New note</Btn>}
      />

      {showNewNote && (
        <Card className="p-4 mb-5 flex gap-3 items-center flex-wrap">
          <input
            className={`${inputCls} flex-1 min-w-48`}
            placeholder="Note title (e.g. Taxation — Chapter 3 Summary)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createNote()}
            autoFocus
          />
          <Btn onClick={createNote}>Create note</Btn>
        </Card>
      )}

      {notes.length === 0 ? (
        <Empty icon="📝" title="No notes yet" sub="Click New note above to write your first one." />
      ) : (
        <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4">
          {notes.map(n => (
            <Card key={n.id} className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="w-11 h-11 rounded-xl bg-accent-50 grid place-items-center text-xl">📝</div>
                {n.is_pinned && <Pill tone="amber">Pinned</Pill>}
              </div>
              <h3 className="font-semibold line-clamp-1">{n.title}</h3>
              <p className="text-xs text-slate-500 mb-3 line-clamp-3 min-h-9">
                {stripHtml(n.content ?? '') || 'No content yet'}
              </p>
              <p className="text-[11px] text-slate-400 mb-3">
                {new Date(n.created_at).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <Btn className="flex-1" onClick={() => openEditor(n)}><Pencil size={15} /> Open</Btn>
                <Btn variant="ghost" onClick={() => togglePin(n)} title={n.is_pinned ? 'Unpin note' : 'Pin note'}>
                  <Star size={15} className={n.is_pinned ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                </Btn>
                <Btn variant="ghost" onClick={() => deleteNote(n)} title="Delete note" className="text-slate-300 hover:text-red-500">
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