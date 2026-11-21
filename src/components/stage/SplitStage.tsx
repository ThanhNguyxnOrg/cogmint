import { useRef } from 'react'
import { AlertTriangle, Plus, TerminalSquare } from 'lucide-react'
import type { HarnessSpec } from '../../types/ipc'
import type { SplitDirection, SplitNode, WorkspaceRecord } from '../../types/workspace'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { killPty } from '../../lib/tauri'
import { Btn } from '../ui/Primitives'
import { ResizeHandle } from '../ui/ResizeHandle'
import { PaneTabBar } from './PaneTabBar'
import { TerminalPane } from './TerminalPane'

interface SplitStageProps {
  workspace: WorkspaceRecord | null
  onLaunchAgent: (workspaceId: string, splitDirection?: SplitDirection, leafId?: string) => void
}

function SplitTreeView({
  node,
  workspace,
  harnessesById,
  onLaunchAgent,
}: {
  node: SplitNode
  workspace: WorkspaceRecord
  harnessesById: Record<string, HarnessSpec>
  onLaunchAgent: (workspaceId: string, splitDirection?: SplitDirection, leafId?: string) => void
}) {
  const panesById = useWorkspaceStore((s) => s.panesById)
  const focusedLeafId = useWorkspaceStore((s) => s.focusedLeafId)
  const setFocusedLeaf = useWorkspaceStore((s) => s.setFocusedLeaf)
  const focusPane = useWorkspaceStore((s) => s.focusPane)
  const closePane = useWorkspaceStore((s) => s.closePane)
  const togglePinPane = useWorkspaceStore((s) => s.togglePinPane)
  const resizeSplit = useWorkspaceStore((s) => s.resizeSplit)
  const containerRef = useRef<HTMLDivElement | null>(null)

  if (node.type === 'split') {
    const isRow = node.direction === 'vertical'
    const firstPct = `${(node.ratio * 100).toFixed(2)}%`
    const secondPct = `${((1 - node.ratio) * 100).toFixed(2)}%`
    return (
      <div
        ref={containerRef}
        className={`flex h-full w-full min-h-0 min-w-0 ${isRow ? 'flex-row' : 'flex-col'}`}
      >
        <div style={isRow ? { width: firstPct } : { height: firstPct }} className="min-h-0 min-w-0">
          <SplitTreeView
            node={node.first}
            workspace={workspace}
            harnessesById={harnessesById}
            onLaunchAgent={onLaunchAgent}
          />
        </div>
        <ResizeHandle
          orientation={isRow ? 'vertical' : 'horizontal'}
          ariaLabel={isRow ? 'Resize vertical split' : 'Resize horizontal split'}
          onDragDelta={(deltaPx) => {
            const el = containerRef.current
            if (!el) return
            const total = isRow ? el.clientWidth : el.clientHeight
            if (total <= 0) return
            resizeSplit(workspace.id, node.id, node.ratio + deltaPx / total)
          }}
          onReset={() => resizeSplit(workspace.id, node.id, 0.5)}
        />
        <div
          style={isRow ? { width: secondPct } : { height: secondPct }}
          className="min-h-0 min-w-0"
        >
          <SplitTreeView
            node={node.second}
            workspace={workspace}
            harnessesById={harnessesById}
            onLaunchAgent={onLaunchAgent}
          />
        </div>
      </div>
    )
  }

  const leafPanes = node.paneIds
    .map((id) => panesById[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const activePane = leafPanes.find((p) => p.id === node.activePaneId) ?? leafPanes[0] ?? null
  const isFocused = focusedLeafId === node.id

  return (
    <div
      className="flex h-full w-full min-h-0 min-w-0 flex-col bg-sunken"
      onMouseDown={() => setFocusedLeaf(node.id)}
    >
      <PaneTabBar
        panes={leafPanes}
        activePaneId={activePane?.id ?? null}
        harnessesById={harnessesById}
        isFocused={isFocused}
        onSelectTab={(paneId) => focusPane(paneId)}
        onCloseTab={(paneId) => {
          void killPty(paneId)
          closePane(paneId)
        }}
        onTogglePin={(paneId) => togglePinPane(paneId)}
        onLaunchTab={() => onLaunchAgent(workspace.id, undefined, node.id)}
        onSplit={(dir) => onLaunchAgent(workspace.id, dir, node.id)}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {leafPanes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-fg-3">No active pane</div>
        ) : (
          leafPanes.map((pane) => {
            const isVisible = pane.id === activePane?.id
            return (
              <div
                key={pane.id}
                className={isVisible ? 'h-full w-full' : 'hidden h-full w-full'}
              >
                <TerminalPane
                  pane={pane}
                  workspace={workspace}
                  harness={harnessesById[pane.harnessId]}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function SplitStage({ workspace, onLaunchAgent }: SplitStageProps) {
  const treesByWorkspaceId = useWorkspaceStore((s) => s.treesByWorkspaceId)
  const harnesses = useWorkspaceStore((s) => s.harnesses)
  const harnessesById = Object.fromEntries(harnesses.map((h) => [h.id, h]))

  if (!workspace) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-sunken p-8 text-center">
        <TerminalSquare className="size-8 text-fg-3" />
        <h2 className="mt-3 text-[13px] font-semibold text-fg">
          No Workspace Selected
        </h2>
        <p className="mt-1 max-w-xs text-[11px] text-fg-3">
          Add a Git repository or local folder from the Attention Rail to launch parallel CLI agents.
        </p>
      </div>
    )
  }

  if (workspace.unavailable) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-sunken p-8 text-center">
        <AlertTriangle className="size-8 text-attn" />
        <h2 className="mt-3 text-[13px] font-semibold text-fg">
          Workspace Directory Unavailable
        </h2>
        <p className="mt-1 max-w-md font-mono text-[11px] text-fg-3">{workspace.path}</p>
        <p className="mt-2 max-w-md text-[11px] text-fg-2">
          This directory was moved or deleted outside COGMINT. Your session journal was preserved safely.
        </p>
      </div>
    )
  }

  const tree = treesByWorkspaceId[workspace.id] ?? null
  if (!tree) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-sunken p-8 text-center">
        <TerminalSquare className="size-8 text-fg-3" />
        <h2 className="mt-3 text-[13px] font-semibold text-fg">
          {workspace.branch ?? workspace.name}
        </h2>
        <p className="mt-1 font-mono text-[11px] text-fg-3">{workspace.path}</p>
        <Btn
          variant="primary"
          className="mt-4"
          onClick={() => onLaunchAgent(workspace.id)}
        >
          <Plus className="size-3.5" />
          Launch CLI Harness
        </Btn>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <SplitTreeView
        node={tree}
        workspace={workspace}
        harnessesById={harnessesById}
        onLaunchAgent={onLaunchAgent}
      />
    </div>
  )
}
