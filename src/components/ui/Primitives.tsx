import { useId, type ButtonHTMLAttributes } from 'react'
import type { AttentionState, HarnessSpec } from '../../types/ipc'
import { formatShortcut } from '../../lib/keybindings'

export const STATUS_META: Record<AttentionState, { label: string; color: string }> = {
  working: { label: 'Working', color: '#2F6FFF' },
  needs_attention: { label: 'Needs attention', color: '#F59E0B' },
  done: { label: 'Done', color: '#10B981' },
  failed: { label: 'Failed', color: '#F43F5E' },
  idle: { label: 'Idle', color: '#64748B' },
  hibernated: { label: 'Hibernated', color: '#475569' },
}

export function Kbd({ keys, className = '' }: { keys: string; className?: string }) {
  return (
    <kbd
      className={`inline-flex h-4 items-center rounded-[3px] border border-line bg-white/[0.02] px-1 font-mono text-[10px] leading-none font-normal tracking-tight text-fg-3 ${className}`}
    >
      {formatShortcut(keys)}
    </kbd>
  )
}

export function StatusDot({ status, size = 8 }: { status: AttentionState; size?: number }) {
  const c = STATUS_META[status].color
  if (status === 'hibernated') {
    return (
      <svg
        width={size + 1}
        height={size + 1}
        viewBox="0 0 10 10"
        className="shrink-0"
        aria-label="Hibernated"
      >
        <circle
          cx="5"
          cy="5"
          r="4"
          fill="none"
          stroke="#64748B"
          strokeWidth="1.3"
          strokeDasharray="2.1 1.6"
        />
      </svg>
    )
  }
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      aria-label={STATUS_META[status].label}
    >
      {status === 'working' && (
        <span
          className="absolute inset-0 animate-pulse-ring rounded-full"
          style={{ background: c }}
        />
      )}
      <span
        className="relative inline-block rounded-full"
        style={{
          width: size,
          height: size,
          background: c,
          boxShadow: status === 'needs_attention' ? '0 0 0 2.5px rgba(245,158,11,0.18)' : undefined,
        }}
      />
    </span>
  )
}

export function LogoMark({ size = 18 }: { size?: number }) {
  const id = `lm${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <mask id={id}>
          <rect width="24" height="24" fill="white" />
          <circle cx="12" cy="12" r="3.6" fill="black" />
        </mask>
      </defs>
      <g fill="#2F6FFF" mask={`url(#${id})`}>
        <path d="M11.1 4.05 A8 8 0 0 0 11.1 19.95 Z" />
        <rect x="1.6" y="10.4" width="3.4" height="3.2" rx="0.7" />
        <rect x="1.6" y="10.4" width="3.4" height="3.2" rx="0.7" transform="rotate(48 12 12)" />
        <rect x="1.6" y="10.4" width="3.4" height="3.2" rx="0.7" transform="rotate(-48 12 12)" />
      </g>
      <path
        d="M12.9 19.7 C12.6 11.6 15.4 5.9 21 3.9 C22.1 10.6 19.4 17.6 12.9 19.7 Z"
        fill="#05DCA3"
      />
      <path d="M13.9 18.3 L18.9 7.6" stroke="#0B0F17" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.7" fill="#F8FAFC" />
    </svg>
  )
}

export function HarnessGlyph({
  harness,
  size = 16,
}: {
  harness?: Pick<HarnessSpec, 'mono' | 'accentColor'>
  size?: number
}) {
  const color = harness?.accentColor ?? '#64748B'
  const mono = harness?.mono ?? 'SH'
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[4px] font-mono font-semibold tracking-tighter"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(7.5, size * 0.42),
        color,
        background: `${color}1A`,
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
    >
      {mono}
    </span>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Btn({
  variant = 'secondary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary:
      'bg-cobalt text-white hover:bg-cobalt-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    secondary: 'bg-white/[0.03] text-fg border border-line-strong hover:bg-hover',
    ghost: 'text-fg-2 hover:text-fg hover:bg-white/[0.05]',
    danger: 'bg-fail/10 text-fail border border-fail/30 hover:bg-fail/15',
  }
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
