import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Folder, GitBranch, Plus } from 'lucide-react'
import type { HarnessSpec } from '../../types/ipc'
import type { PaneRuntimeState, WorkspaceRecord } from '../../types/workspace'
import { HarnessGlyph, StatusDot } from '../ui/Primitives'

interface WorktreeCardProps {
  workspace: WorkspaceRecord
  panes: PaneRuntimeState[]
  harnessesById: Record<string, HarnessSpec>
  isActive: boolean
  isOnlyCard: boolean
  unreadOnly: boolean
  onSelectWorkspace: () => void
  onSelectPane: (paneId: string) => void
  onLaunchAgent: () => void
}

export function WorktreeCard({
  workspace,
  panes,
  harnessesById,
  isActive,
  isOnlyCard,
  unreadOnly,
  onSelectWorkspace,
  onSelectPane,
  onLaunchAgent,
}: WorktreeCardProps) {
  const [expanded, setExpanded] = useState(true)
  const visiblePanes = unreadOnly
    ? panes.filter(
        (p) =>
          p.unread ||
          p.attentionState === 'needs_attention' ||
          p.attentionState === 'failed',
      )
    : panes

  const isExpanded = isOnlyCard || expanded

  return (
    <div
      className={`rounded-md border transition-colors ${
        isActive
          ? 'border-line-strong bg-raised/90'
          : 'border-transparent bg-transparent hover:bg-white/[0.025]'
      }`}
    >
      <div
        className="group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer"
        onClick={() => {
          onSelectWorkspace()
          if (!isOnlyCard) setExpanded((v) => !v)
        }}
      >
        {!isOnlyCard ? (
          isExpanded ? (
            <ChevronDown className="size-3 shrink-0 text-fg-3" />
          ) : (
            <ChevronRight className="size-3 shrink-0 text-fg-3" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {workspace.isGitRepo ? (
          <GitBranch className="size-3 shrink-0 text-fg-3" />
        ) : (
          <Folder className="size-3 shrink-0 text-fg-3" />
        )}

        <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-fg">
          {workspace.branch ?? workspace.name}
        </span>

        {!workspace.isGitRepo && (
          <span className="rounded bg-white/[0.04] px-1 py-0.5 text-[9px] text-fg-3">
            Non-Git
          </span>
        )}

        {workspace.unavailable && (
          <span title="Directory missing on disk">
            <AlertTriangle className="size-3 shrink-0 text-attn" />
          </span>
        )}

        <button
          type="button"
          title="Launch agent in workspace"
          onClick={(e) => {
            e.stopPropagation()
            onLaunchAgent()
          }}
          className="rounded p-0.5 text-fg-3 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-fg group-hover:opacity-100 cursor-pointer"
        >
          <Plus className="size-3" />
        </button>
      </div>

      {isExpanded && visiblePanes.length > 0 && (
        <div className="space-y-0.5 px-1.5 pb-1.5">
          {visiblePanes.map((pane) => {
            const harness = harnessesById[pane.harnessId]
            return (
              <button
                key={pane.id}
                type="button"
                onClick={() => onSelectPane(pane.id)}
                className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-hover/80 cursor-pointer"
              >
                <div className="mt-0.5 flex items-center gap-1.5">
                  <StatusDot status={pane.attentionState} size={7} />
                  <HarnessGlyph harness={harness} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] font-medium text-fg">
                      {pane.title}
                    </span>
                    {pane.unread && (
                      <span className="size-1.5 shrink-0 rounded-full bg-attn" />
                    )}
                  </div>
                  {pane.latestWords && (
                    <p className="truncate font-mono text-[10px] text-fg-3">
                      {pane.latestWords}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
