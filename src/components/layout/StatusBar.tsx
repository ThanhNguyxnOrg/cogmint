import { GitBranch, Terminal } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Kbd } from '../ui/Primitives'

interface StatusBarProps {
  todaySpendUsd: number
  todayTokens: number
  onOpenUsage: () => void
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

export function StatusBar({ todaySpendUsd, todayTokens, onOpenUsage }: StatusBarProps) {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const panesById = useWorkspaceStore((s) => s.panesById)
  const defaultShellId = useSettingsStore((s) => s.defaultShellId)

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId)
  const panes = Object.values(panesById)
  const working = panes.filter((p) => p.attentionState === 'working').length
  const waiting = panes.filter((p) => p.attentionState === 'needs_attention').length
  const hibernated = panes.filter((p) => p.attentionState === 'hibernated').length

  return (
    <footer className="flex h-[26px] shrink-0 items-center justify-between border-t border-line bg-rail px-3 font-mono text-[10px] text-fg-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex items-center gap-1 text-fg-2">
          <Terminal className="size-3 text-fg-3" />
          {activeWs?.shellProfile ?? defaultShellId ?? 'shell'}
        </span>
        {activeWs && (
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <GitBranch className="size-3 shrink-0 text-fg-3" />
            <span className="truncate">{activeWs.branch ?? activeWs.name}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 tabular-nums">
        <span>
          {working} working ·{' '}
          <span className={waiting > 0 ? 'text-attn' : ''}>{waiting} waiting</span> · {hibernated}{' '}
          hibernated
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenUsage}
          className="tabular-nums text-fg-2 hover:text-fg cursor-pointer"
        >
          ${todaySpendUsd.toFixed(2)} · {formatTokens(todayTokens)} tok
        </button>
        <span className="hidden items-center gap-1.5 md:inline-flex">
          <Kbd keys="⌘T" /> Agent
          <Kbd keys="⌘⇧A" /> Attention
          <Kbd keys="⌘K" /> Palette
        </span>
      </div>
    </footer>
  )
}
