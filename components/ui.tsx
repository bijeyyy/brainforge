import { ReactNode } from 'react'

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-card shadow-card transition
        ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lift hover:border-primary-100' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'ai' | 'danger'
export function Btn({ children, onClick, variant = 'primary', className = '', disabled, title }: {
  children: ReactNode; onClick?: () => void; variant?: BtnVariant; className?: string; disabled?: boolean; title?: string
}) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-primary text-white hover:brightness-110',
    ai: 'bg-accent text-white hover:brightness-110',
    ghost: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-500 text-white hover:brightness-110',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[10px] text-sm font-semibold
        transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

type Tone = 'green' | 'amber' | 'red' | 'indigo' | 'violet'
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const map: Record<Tone, string> = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-primary-50 text-primary',
    violet: 'bg-accent-50 text-accent',
  }
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-0.5 ${map[tone]}`}>{children}</span>
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-slate-200 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function Empty({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: ReactNode }) {
  return (
    <Card className="p-12 text-center">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-slate-500 mb-4">{sub}</p>
      {action}
    </Card>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-primary animate-spin" />
    </div>
  )
}
