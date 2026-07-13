'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Btn } from '@/components/ui'

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

  const input = 'w-full h-10 px-3.5 rounded-[10px] border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition'

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-[380px] page-in">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center text-white font-bold text-lg">B</div>
            <span className="font-display font-semibold text-xl">BrainForge <span className="text-accent">AI</span></span>
          </div>
          <h1 className="text-2xl font-semibold mb-1">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="text-sm text-slate-500 mb-6">{mode === 'login' ? 'Log in to continue studying.' : 'Start mastering your exams today.'}</p>

          <button
            onClick={signInWithGoogle}
            className="w-full h-10 mb-4 rounded-[10px] border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2.5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or use email</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="space-y-3">
            {mode === 'register' && (
              <input className={input} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
            )}
            <input className={input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input className={input} type="password" placeholder="Password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-green-700">{info}</p>}
            <Btn className="w-full" onClick={submit} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </Btn>
          </div>

          <p className="text-sm text-slate-500 mt-5 text-center">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button className="text-primary font-semibold" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
      <div className="flex-1 max-lg:hidden bg-gradient-to-br from-primary to-accent grid place-items-center p-10">
        <div className="text-white max-w-sm">
          <div className="text-4xl mb-4">🔥</div>
          <h2 className="text-2xl font-semibold mb-2">Study less. Master more.</h2>
          <p className="text-white/80 text-sm leading-relaxed">
            AI-generated reviewers, spaced-repetition flashcards, and real exam simulations — everything a reviewee needs in one place.
          </p>
        </div>
      </div>
    </div>
  )
}
