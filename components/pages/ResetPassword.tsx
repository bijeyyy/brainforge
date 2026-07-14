'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Btn } from '@/components/ui'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(''); setBusy(true)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setBusy(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else router.replace('/')
    setBusy(false)
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white dark:bg-slate-950 p-6">
      <div className="w-full max-w-[380px]">
        <h1 className="text-2xl font-semibold mb-1 text-slate-900 dark:text-white">Set your password</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          After this, you'll be able to log in manually with your email and password, even if you originally signed up with Google.
        </p>
        <div className="space-y-3">
          <input
            className="w-full h-10 px-3.5 rounded-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-sm outline-none focus:ring-2 focus:ring-primary"
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Btn className="w-full" onClick={submit} disabled={busy}>
            {busy ? 'Please wait…' : 'Save password'}
          </Btn>
        </div>
      </div>
    </div>
  )
}