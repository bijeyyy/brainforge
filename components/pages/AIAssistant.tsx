'use client'

import { useRef, useState } from 'react'
import { RotateCcw, Send, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface Msg { role: 'user' | 'assistant'; content: string }

const capabilities = [
  { icon: '📄', label: 'Generate Reviewer', prompt: 'Generate a structured reviewer outline for Basic Calculus (limits, continuity, derivatives).' },
  { icon: '❓', label: 'Generate Quiz', prompt: 'Create a 5-question multiple choice quiz on cell division, with answers and explanations.' },
  { icon: '🃏', label: 'Generate Flashcards', prompt: 'Create 8 flashcards (front/back) about the parts of a cell.' },
  { icon: '🧒', label: "Explain Like I'm 10", prompt: "Explain what a mathematical limit is like I'm 10 years old." },
]

export default function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setBusy(true)

    // Calls the built-in Next.js API route (app/api/ai-chat/route.ts)
    let reply: string
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        // Show the REAL error from the server so problems are easy to diagnose
        reply =
          `⚠️ AI route error (HTTP ${res.status}):\n${data.error ?? 'Unknown error — no message returned.'}\n\n` +
          'Checklist: (1) app/api/ai-chat/route.ts contains your provider code, ' +
          '(2) the matching key (e.g. GEMINI_API_KEY) is in .env.local, ' +
          '(3) you restarted the dev server after editing .env.local.'
      } else {
        reply = data.text ?? 'Sorry, I could not generate a response.'
      }
    } catch (err) {
      reply =
        `⚠️ Could not reach /api/ai-chat at all: ${String(err)}\n\n` +
        'This usually means the route file is missing — confirm the file exists at exactly app/api/ai-chat/route.ts, then restart the dev server.'
    }
    setMessages(m => [...m, { role: 'assistant', content: reply }])
    setBusy(false)
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50)
  }

  function handleNewChat() {
    if (messages.length === 0) {
      restart()
      return
    }

    setOpen(true)
  }

  function restart() {
    setMessages([])
    setInput("")
    setBusy(false)
    setOpen(false)
  }

  return (
    <div className="page-in flex flex-col h-[calc(100vh-3.5rem)] w-full max-w-3xl mx-auto px-3 sm:px-4 lg:px-0">
      {messages.length > 0 && (
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-3 border-b border-slate-200 mb-1">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center text-white"><Sparkles size={13} /></span>
            AI Assistant
          </div>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
              title="Clear the conversation and ask about something new"
            >
              <RotateCcw size={13} /> New chat
            </button>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start a new chat?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your current conversation will be permanently cleared.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={restart}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {messages.length === 0 && (
        <div className="text-center pt-10 pb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-white mx-auto mb-4 animate-pulse">
            <Sparkles size={26} />
          </div>
          <h1 className="text-2xl font-semibold">What are we mastering today?</h1>
          <p className="text-sm text-slate-500 mb-6">Generate reviewers, quizzes, flashcards — or just ask anything.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {capabilities.map(c => (
              <button key={c.label} onClick={() => send(c.prompt)}
                className="bg-white border border-slate-200 rounded-xl p-3.5 text-left text-[13px] font-semibold hover:border-accent hover:text-accent transition">
                <span className="text-lg block mb-1.5">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 pb-24 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 page-in ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center text-white shrink-0">
                <Sparkles size={14} />
              </div>
            )}
            <div className={`max-w-[92%] sm:max-w-[82%] lg:max-w-[78%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed
              ${m.role === 'user' ? 'bg-primary-50 border border-primary-100' : 'bg-white border border-slate-200'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center text-white shrink-0"><Sparkles size={14} /></div>
            <Card className="px-4 py-3 text-sm text-slate-400">Thinking…</Card>
          </div>
        )}
      </div>

      <div className="sticky md:bottom-3 bottom-12 mt-2 flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-lift z-10">
        <input
          className="flex-1 outline-none text-sm px-2 py-4"
          placeholder="Ask anything… (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button onClick={() => send()} disabled={busy}
          className="w-9 h-9 rounded-xl bg-accent text-white grid place-items-center hover:brightness-110 disabled:opacity-50 transition">
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
