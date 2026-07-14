'use client'

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { LayoutDashboard, BookOpen, Layers, HelpCircle, FileText, Sparkles, Zap, Trophy, TrendingUp, LogOut, Flame, Settings, Moon, Sun, Highlighter, Menu, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { levelFromXp, levelProgress } from '@/lib/api'
import { Profile } from '@/types'
import { Spinner } from '@/components/ui'

const ProfileContext = createContext<{ profile: Profile | null; refreshProfile: () => void }>({
  profile: null,
  refreshProfile: () => { },
})
export const useProfile = () => useContext(ProfileContext)

const nav = [
  {
    section: 'Study', items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/notes', label: 'Notes', icon: BookOpen },
      { to: '/flashcards', label: 'Flashcards', icon: Layers },
      { to: '/quizzes', label: 'Quizzes', icon: HelpCircle },
      { to: '/mock-exam', label: 'Mock Exams', icon: FileText },
      { to: '/reviewers', label: 'Reviewers', icon: Highlighter },
    ]
  },
  {
    section: 'AI', items: [
      { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
    ]
  },
  {
    section: 'Motivation', items: [
      { to: '/challenge', label: 'Daily Challenge', icon: Zap },
      { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
      { to: '/progress', label: 'Progress', icon: TrendingUp },
    ]
  },
  {
    section: 'Account', items: [
      { to: '/settings', label: 'Settings', icon: Settings },
    ]
  },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dark, setDark] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const isDark = typeof window !== 'undefined' && localStorage.getItem('bf-theme') === 'dark'
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  // Close the mobile/tablet drawer whenever the route changes
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    localStorage.setItem('bf-theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  const refreshProfile = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single()
    setProfile(data as Profile | null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (!data.session) router.replace('/login')
      else refreshProfile()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) router.replace('/login')
      else refreshProfile()
    })
    return () => sub.subscription.unsubscribe()
  }, [router, refreshProfile])

  if (loading) return <Spinner />
  if (!session) return null

  // Shared nav list, reused by the desktop sidebar and the mobile/tablet drawer
  const NavList = () => (
    <>
      {nav.map(group => (
        <div key={group.section}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-4 pb-1.5">{group.section}</div>
          {group.items.map(item => {
            const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
            return (
              <Link key={item.to} href={item.to}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition
                  ${active
                    ? 'bg-primary-50 text-primary dark:bg-primary/15 dark:text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'}`}>
                <item.icon size={18} className={item.label === 'AI Assistant' ? 'text-accent' : ''} />
                {item.label}
                {item.label === 'AI Assistant' && (
                  <span className="ml-auto text-[10px] font-semibold bg-accent-100 text-accent dark:bg-accent/20 dark:text-violet-300 px-1.5 py-px rounded-full">AI</span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </>
  )

  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 px-3 py-2 mb-1 rounded-[10px] text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100 transition"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  )

  const StreakCard = () => (
    <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 rounded-xl px-3 py-2.5 mb-2">
      <Flame size={18} className="text-amber-500" />
      <div className="text-sm">
        <b className="text-slate-900 dark:text-slate-100">{profile?.streak ?? 0}-day streak</b>
        <div className="text-xs text-slate-500 dark:text-slate-400">Keep it going!</div>
      </div>
    </div>
  )

  const AccountRow = () => (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-red-400 grid place-items-center text-white font-semibold text-sm ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shrink-0">
        {(profile?.full_name ?? 'U')[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate text-slate-900 dark:text-slate-100">{profile?.username ?? profile?.full_name ?? 'Learner'}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Lv {levelFromXp(profile?.xp ?? 0)} · {levelProgress(profile?.xp ?? 0)}%</div>
      </div>
      <button title="Log out" onClick={() => supabase.auth.signOut()} className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 shrink-0">
        <LogOut size={16} />
      </button>
    </div>
  )

  return (
    <ProfileContext.Provider value={{ profile, refreshProfile }}>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Desktop sidebar — shown from lg breakpoint up */}
        <aside className="w-[264px] shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col p-4 hidden lg:flex overflow-hidden">
          <div className="flex items-center gap-2.5 px-2 pb-5 shrink-0">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary-600 to-accent grid place-items-center text-white font-bold">B</div>
            <span className="text-primary-600 dark:text-white font-display font-semibold text-lg">BrainForge <span className="text-accent">AI</span></span>
          </div>

          <div className="flex-1 overflow-y-auto -mr-1 pr-1 min-h-0">
            <NavList />
          </div>

          <div className="shrink-0 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <ThemeToggle />
            <StreakCard />
            <AccountRow />
          </div>
        </aside>

        {/* Mobile / tablet top bar — shown below lg */}
        <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-primary-600 to-accent grid place-items-center text-white font-bold text-xs shrink-0">B</div>
            <span className="text-primary-600 dark:text-white font-display font-semibold text-base truncate">BrainForge AI</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-500 shrink-0">
            <Flame size={18} />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{profile?.streak ?? 0}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-red-400 grid place-items-center text-white font-semibold text-xs ring-2 ring-primary ring-offset-1 ring-offset-white dark:ring-offset-slate-900 shrink-0">
            {(profile?.full_name ?? 'U')[0]}
          </div>
        </header>

        {/* Mobile / tablet drawer + backdrop */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw] bg-white dark:bg-slate-900 flex flex-col p-4 shadow-xl">
              <div className="flex items-center justify-between pb-5">
                <div className="flex items-center gap-2.5 px-2">
                  <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary-600 to-accent grid place-items-center text-white font-bold">B</div>
                  <span className="text-primary-600 dark:text-white font-display font-semibold text-lg">BrainForge AI</span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto -mr-1 pr-1">
                <NavList />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <ThemeToggle />
                <StreakCard />
                <AccountRow />
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
          <div className="max-w-[1180px] mx-auto px-4 py-5 md:px-6 md:py-7">{children}</div>
        </main>
      </div>
    </ProfileContext.Provider>
  )
}