import { useState } from 'react'
import { FolderPlus, GitBranchPlus } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { WorktreeCard } from './WorktreeCard'

interface AttentionRailProps {
  width: number
  onAddProject: () => void
  onCreateWorktree: (projectId: string) => void
  onLaunchAgent: (workspaceId: string) => void
}

export function AttentionRail({
  width,
  onAddProject,
  onCreateWorktree,
  onLaunchAgent,
}: AttentionRailProps) {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const projects = useWorkspaceStore((s) => s.projects)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const panesById = useWorkspaceStore((s) => s.panesById)
  const harnesses = useWorkspaceStore((s) => s.harnesses)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const focusPane = useWorkspaceStore((s) => s.focusPane)

  const harnessesById = Object.fromEntries(harnesses.map((h) => [h.id, h]))
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
  const activeProject = projects.find((p) => p.id === activeWorkspace?.projectId)

  return (
    <aside
      style={{ width }}
      className="flex h-full shrink-0 flex-col border-r border-line bg-rail"
    >
      <div className="flex h-9 items-center justify-between border-b border-line px-3">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-fg-3 uppercase">
          Workspaces
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
              unreadOnly
                ? 'bg-attn/15 text-attn ring-1 ring-attn/30'
                : 'text-fg-3 hover:bg-white/[0.05] hover:text-fg-2'
            }`}
          >
            Unread
          </button>
          <button
            type="button"
            title="Add project directory"
            onClick={onAddProject}
            className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
          >
            <FolderPlus className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-2">
        {projects.length === 0 ? (
          <div className="rounded-md border border-dashed border-line p-3 text-center">
            <p className="text-[11px] text-fg-2">No projects yet</p>
            <p className="mt-1 text-[10px] text-fg-3">
              Open any Git repo or local folder to run parallel CLI agents.
            </p>
            <button
              type="button"
              onClick={onAddProject}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-cobalt px-2.5 py-1 text-[11px] font-medium text-white hover:bg-cobalt-hover cursor-pointer"
            >
              <FolderPlus className="size-3" />
              Add Project
            </button>
          </div>
        ) : (
          projects.map((proj) => {
            const projWorkspaces = workspaces.filter((w) => w.projectId === proj.id)
            return (
              <div key={proj.id} className="space-y-1">
                <div className="flex items-center justify-between px-1.5">
                  <span className="truncate text-[10px] font-semibold tracking-wider text-fg-3 uppercase">
                    {proj.name}
                  </span>
                  {proj.isGitRepo && (
                    <button
                      type="button"
                      title="New Git worktree"
                      onClick={() => onCreateWorktree(proj.id)}
                      className="rounded p-0.5 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
                    >
                      <GitBranchPlus className="size-3" />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {projWorkspaces.map((ws) => {
                    const wsPanes = Object.values(panesById).filter(
                      (p) => p.workspaceId === ws.id,
                    )
                    return (
                      <WorktreeCard
                        key={ws.id}
                        workspace={ws}
                        panes={wsPanes}
                        harnessesById={harnessesById}
                        isActive={ws.id === activeWorkspaceId}
                        isOnlyCard={projWorkspaces.length === 1}
                        unreadOnly={unreadOnly}
                        onSelectWorkspace={() => setActiveWorkspace(ws.id)}
                        onSelectPane={(paneId) => focusPane(paneId)}
                        onLaunchAgent={() => onLaunchAgent(ws.id)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {activeProject?.isGitRepo && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={() => onCreateWorktree(activeProject.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-white/[0.02] py-1.5 text-[11px] font-medium text-fg-2 hover:bg-hover hover:text-fg cursor-pointer"
          >
            <GitBranchPlus className="size-3.5" />
            New Worktree
          </button>
        </div>
      )}
    </aside>
  )
}
