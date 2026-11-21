import { Columns2, Pin, Plus, Rows2, X } from 'lucide-react'
import type { HarnessSpec } from '../../types/ipc'
import type { PaneRuntimeState, SplitDirection } from '../../types/workspace'
import { HarnessGlyph, StatusDot } from '../ui/Primitives'

interface PaneTabBarProps {
  panes: PaneRuntimeState[]
  activePaneId: string | null
  harnessesById: Record<string, HarnessSpec>
  isFocused: boolean
  onSelectTab: (paneId: string) => void
  onCloseTab: (paneId: string) => void
  onTogglePin: (paneId: string) => void
  onLaunchTab: () => void
  onSplit: (dir: SplitDirection) => void
}

export function PaneTabBar({
  panes,
  activePaneId,
  harnessesById,
  isFocused,
  onSelectTab,
  onCloseTab,
  onTogglePin,
  onLaunchTab,
  onSplit,
}: PaneTabBarProps) {
  return (
    <div
      className={`flex h-8 shrink-0 items-center justify-between border-b px-1.5 ${
        isFocused ? 'border-line-strong bg-raised' : 'border-line bg-rail'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {panes.map((pane) => {
          const active = pane.id === activePaneId
          return (
            <div
              key={pane.id}
              onClick={() => onSelectTab(pane.id)}
              className={`group flex h-6 max-w-[180px] shrink-0 items-center gap-1.5 rounded px-2 text-[11px] transition-colors cursor-pointer ${
                active
                  ? 'bg-sunken text-fg ring-1 ring-line-strong'
                  : 'text-fg-2 hover:bg-white/[0.04] hover:text-fg'
              }`}
            >
              {pane.pinned && <Pin className="size-2.5 shrink-0 text-cobalt" />}
              <StatusDot status={pane.attentionState} size={6} />
              <HarnessGlyph harness={harnessesById[pane.harnessId]} size={14} />
              <span className="truncate font-medium">{pane.title}</span>
              <button
                type="button"
                title={pane.pinned ? 'Unpin tab' : 'Pin tab'}
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePin(pane.id)
                }}
                className="ml-0.5 rounded p-0.5 text-fg-3 opacity-0 hover:bg-white/[0.08] hover:text-fg group-hover:opacity-100 cursor-pointer"
              >
                <Pin className="size-2.5" />
              </button>
              {!pane.pinned && (
                <button
                  type="button"
                  title="Close pane"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTab(pane.id)
                  }}
                  className="rounded p-0.5 text-fg-3 opacity-0 hover:bg-white/[0.08] hover:text-fg group-hover:opacity-100 cursor-pointer"
                >
                  <X className="size-2.5" />
                </button>
              )}
            </div>
          )
        })}
        <button
          type="button"
          title="Launch harness tab"
          onClick={onLaunchTab}
          className="ml-0.5 rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
        >
          <Plus className="size-3" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pl-1">
        <button
          type="button"
          title="Split right"
          onClick={() => onSplit('vertical')}
          className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
        >
          <Columns2 className="size-3" />
        </button>
        <button
          type="button"
          title="Split down"
          onClick={() => onSplit('horizontal')}
          className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
        >
          <Rows2 className="size-3" />
        </button>
      </div>
    </div>
  )
}
