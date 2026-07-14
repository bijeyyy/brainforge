'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Btn } from '@/components/ui'
import { Layers, HelpCircle, Highlighter, Flame } from 'lucide-react'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function signInWithGoogle() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) setError(error.message)
    // On success the browser redirects to Google, then back here already logged in.
  }

  async function submit() {
    setError(''); setInfo(''); setBusy(true)
    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: name } },
      })
      if (error) setError(error.message)
      else setInfo('Account created! If email confirmation is enabled, check your inbox — otherwise you are now logged in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.replace('/')
    }
    setBusy(false)
  }

  const input = 'w-full h-10 px-3.5 rounded-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition'

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-950">
      <div className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-[380px] page-in">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center text-white font-bold text-lg">B</div>
            <span className="font-display font-semibold text-xl text-slate-900 dark:text-white">BrainForge <span className="text-accent">AI</span></span>
          </div>
          <h1 className="text-2xl font-semibold mb-1 text-slate-900 dark:text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{mode === 'login' ? 'Log in to continue studying.' : 'Start mastering your exams today.'}</p>

          <button
            onClick={signInWithGoogle}
            className="w-full h-10 mb-4 rounded-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2.5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400 dark:text-slate-500">or use email</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="space-y-3">
            {mode === 'register' && (
              <input className={input} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
            )}
            <input className={input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input className={input} type="password" placeholder="Password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {info && <p className="text-sm text-green-700 dark:text-green-400">{info}</p>}
            <Btn className="w-full" onClick={submit} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </Btn>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-5 text-center">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button className="text-primary dark:text-white font-semibold" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </button>
          </p>
        </div>
      </div>

      {/* Right panel — signature: a stack of tilted flashcards, since that's the core of the product */}
      <div className="flex-1 max-lg:hidden relative overflow-hidden bg-gradient-to-br from-primary to-accent grid place-items-center p-10">
        {/* ambient glow */}
        <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-black/10 blur-3xl" />
        {/* faint dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        />

        <div className="relative text-white max-w-sm">
          {/* floating flashcard stack */}
          <div className="relative h-40 mb-8 flex items-center">
            <div className="absolute left-6 w-40 h-24 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm -rotate-6 shadow-lift" />
            <div className="absolute left-16 w-40 h-24 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-sm rotate-3 shadow-lift" />
            <div className="absolute left-10 w-44 h-28 rounded-2xl bg-white/90 text-slate-800 border border-white/40 shadow-lift flex flex-col justify-between p-4 rotate-[-1deg]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Flashcard · Bio 101</span>
              <span className="text-sm font-semibold leading-snug">Ano ang mitochondria?</span>
              <span className="text-[11px] text-slate-400">Tap to reveal →</span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-2">Study less. Master more.</h2>
          <p className="text-white/80 text-sm leading-relaxed mb-5">
            AI-generated reviewers, spaced-repetition flashcards, at totoong exam simulations — lahat ng kailangan ng isang reviewee, nasa isang lugar lang.
          </p>

          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium bg-white/15 border border-white/20 rounded-full px-3 py-1.5">
              <Layers size={13} /> Flashcards
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium bg-white/15 border border-white/20 rounded-full px-3 py-1.5">
              <HelpCircle size={13} /> Mock exams
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium bg-white/15 border border-white/20 rounded-full px-3 py-1.5">
              <Highlighter size={13} /> Reviewers
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium bg-white/15 border border-white/20 rounded-full px-3 py-1.5">
              <Flame size={13} /> Daily streaks
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}