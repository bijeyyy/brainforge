'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, FileUp, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Question } from '@/types'
import { Btn, Card, Spinner } from '@/components/ui'

const LETTERS = ['A', 'B', 'C', 'D']

export default function QuizBuilder({ quizId, title, onBack }: { quizId: string; title: string; onBack: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [topic, setTopic] = useState('')
  const [saving, setSaving] = useState(false)

  // ── PDF -> AI questions ──
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfProgress, setPdfProgress] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('id')
    setQuestions((data as Question[]) ?? [])
    setLoading(false)
  }, [quizId])
  useEffect(() => { load() }, [load])

  async function addQuestion() {
    const trimmed = options.map(o => o.trim())
    const filled = trimmed.filter(Boolean)
    if (!prompt.trim() || filled.length < 2) { alert('Enter a question and at least 2 answer options.'); return }
    if (!trimmed[correct]) { alert('The option marked as correct is empty — fill it in or pick another.'); return }
    const correctIndex = filled.indexOf(trimmed[correct])

    setSaving(true)
    const { error } = await supabase.from('questions').insert({
      quiz_id: quizId,
      prompt: prompt.trim(),
      options: filled,
      correct_index: correctIndex,
      explanation: explanation.trim() || null,
      topic: topic.trim() || 'General',
    })
    if (error) alert('Could not save: ' + error.message)
    else { setPrompt(''); setOptions(['', '', '', '']); setCorrect(0); setExplanation(''); setTopic(''); await load() }
    setSaving(false)
  }

  async function removeQuestion(id: string) {
    if (!confirm('Delete this question?')) return
    await supabase.from('questions').delete().eq('id', id)
    load()
  }

  // Upload a PDF, ask the AI to turn it into MCQ questions, bulk-insert the result
  async function handlePdfUpload(file: File) {
    if (file.type !== 'application/pdf') {
      setPdfError('Please choose a PDF file.')
      return
    }

    setUploadingPdf(true)
    setPdfError(null)
    setPdfProgress('Reading PDF…')

    try {
      const formData = new FormData()
      formData.append('file', file)

      setPdfProgress('Asking AI to generate questions…')
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }

      const { questions: generated } = await res.json() as {
        questions: { prompt: string; options: string[]; correct_index: number; topic?: string }[]
      }

      if (!generated?.length) {
        throw new Error('The AI could not find enough content to make questions from this PDF.')
      }

      setPdfProgress(`Saving ${generated.length} question${generated.length === 1 ? '' : 's'}…`)
      const { error } = await supabase.from('questions').insert(
        generated.map(q => ({
          quiz_id: quizId,
          prompt: q.prompt.trim(),
          options: q.options.map(o => o.trim()),
          correct_index: q.correct_index,
          topic: (q.topic ?? 'General').trim() || 'General',
        }))
      )
      if (error) throw new Error(error.message)

      await load()
    } catch (err: any) {
      setPdfError(err.message ?? 'Something went wrong generating questions from that PDF.')
    } finally {
      setUploadingPdf(false)
      setPdfProgress(null)
    }
  }

  const input = 'w-full h-10 px-3.5 rounded-[10px] border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary transition'

  if (loading) return <Spinner />

  return (
    <div className="page-in max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900">← Back</button>
        <h1 className="text-xl font-semibold flex-1">{title}</h1>
        <span className="text-sm text-slate-500">{questions.length} question{questions.length === 1 ? '' : 's'}</span>
      </div>

      {/* Generate from a PDF */}
      <Card className="p-5 mb-5">
        <h3 className="font-semibold mb-3">Generate from a PDF</h3>
        <p className="text-xs text-slate-500 mb-3">Upload a reviewer or notes and the AI will turn them into multiple-choice questions automatically.</p>
        <label className={`flex items-center justify-center gap-2 h-10 px-3.5 rounded-[10px] border border-dashed text-sm cursor-pointer transition
          ${uploadingPdf ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-primary/40 text-primary hover:bg-primary-50'}`}>
          {uploadingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
          {uploadingPdf ? (pdfProgress ?? 'Working…') : 'Choose a PDF'}
          <input
            type="file"
            accept="application/pdf"
            disabled={uploadingPdf}
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              e.target.value = '' // allow re-selecting the same file later
              if (file) handlePdfUpload(file)
            }}
          />
        </label>
        {pdfError && <p className="text-xs text-red-500 mt-2">{pdfError}</p>}
      </Card>

      {/* Add-question form */}
      <Card className="p-5 mb-5">
        <h3 className="font-semibold mb-3">Add a question</h3>
        <textarea
          className="w-full min-h-20 px-3.5 py-2.5 rounded-[10px] border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary transition mb-3"
          placeholder="Type the question…"
          value={prompt} onChange={e => setPrompt(e.target.value)}
        />
        <div className="space-y-2 mb-3">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <input
                type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)}
                className="accent-green-600 w-4 h-4 shrink-0" title="Mark as the correct answer"
              />
              <input
                className={input}
                placeholder={`Option ${LETTERS[i]}${i > 1 ? ' (optional)' : ''}`}
                value={opt}
                onChange={e => setOptions(o => o.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </div>
          ))}
          <p className="text-xs text-slate-400 pl-6">Select the radio button next to the correct answer.</p>
        </div>
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-2.5 mb-3">
          <input className={input} placeholder="Topic (e.g. Limits) — optional" value={topic} onChange={e => setTopic(e.target.value)} />
          <input className={input} placeholder="Explanation shown after answering — optional" value={explanation} onChange={e => setExplanation(e.target.value)} />
        </div>
        <Btn onClick={addQuestion} disabled={saving}>{saving ? 'Saving…' : '+ Add question'}</Btn>
      </Card>

      {/* Existing questions */}
      {questions.length === 0 ? (
        <p className="text-sm text-slate-400 text-center">No questions yet — upload a PDF or add your first one above.</p>
      ) : (
        <Card className="divide-y divide-slate-100">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 p-4 text-sm">
              <span className="font-display font-semibold text-slate-400 w-6">{i + 1}.</span>
              <div className="flex-1">
                <div className="font-medium">{q.prompt}</div>
                <div className="text-xs text-slate-500 mt-1">
                  ✓ {q.options[q.correct_index]} <span className="text-slate-300">·</span> {q.topic ?? 'General'}
                </div>
              </div>
              <button onClick={() => removeQuestion(q.id)} className="text-slate-300 hover:text-red-500" title="Delete question">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}