import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Folder, GitMerge, RefreshCw } from 'lucide-react'
import type { FileDiffResult, GitStatusSummary, MergePreview } from '../../types/ipc'
import type { WorkspaceRecord } from '../../types/workspace'
import {
  commitChanges,
  getFileDiff,
  getGitStatus,
  getMergePreview,
  onWorkspaceDirty,
  openInEditor,
  stageFiles,
  unstageFiles,
} from '../../lib/tauri'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Btn } from '../ui/Primitives'
import { UnifiedDiffView } from './UnifiedDiffView'

interface ChangesDrawerProps {
  workspace: WorkspaceRecord | null
}

const STATUS_COLORS: Record<string, string> = {
  M: 'text-attn',
  A: 'text-done',
  D: 'text-fail',
  '?': 'text-fg-3',
}

export function ChangesDrawer({ workspace }: ChangesDrawerProps) {
  const editorPreset = useSettingsStore((s) => s.editorPreset)
  const [status, setStatus] = useState<GitStatusSummary | null>(null)
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [diff, setDiff] = useState<FileDiffResult | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)

  const refresh = useCallback(async () => {
    if (!workspace || !workspace.isGitRepo || workspace.unavailable) {
      setStatus(null)
      setMergePreview(null)
      setDiff(null)
      return
    }
    const nextStatus = await getGitStatus(workspace.path)
    setStatus(nextStatus)
    if (nextStatus.branch && nextStatus.branch !== 'main') {
      try {
        const preview = await getMergePreview(workspace.path, 'main')
        setMergePreview(preview)
      } catch {
        setMergePreview(null)
      }
    } else {
      setMergePreview(null)
    }
  }, [workspace])

  useEffect(() => {
    setSelectedPath(null)
    setDiff(null)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!workspace || !workspace.isGitRepo) return
    let unlisten: (() => void) | null = null
    void onWorkspaceDirty((dirtyId) => {
      if (dirtyId === workspace.id) {
        void refresh()
      }
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [workspace, refresh])

  const loadDiff = async (path: string, staged: boolean) => {
    if (!workspace) return
    setSelectedPath(path)
    setLoadingDiff(true)
    try {
      const res = await getFileDiff(workspace.path, path, staged)
      setDiff(res)
    } finally {
      setLoadingDiff(false)
    }
  }

  const handleToggleStage = async (path: string, currentlyStaged: boolean) => {
    if (!workspace) return
    if (currentlyStaged) {
      await unstageFiles(workspace.path, [path])
    } else {
      await stageFiles(workspace.path, [path])
    }
    await refresh()
  }

  const handleCommit = async () => {
    if (!workspace || !commitMsg.trim()) return
    setCommitting(true)
    try {
      await stageFiles(workspace.path, [])
      await commitChanges(workspace.path, commitMsg.trim())
      setCommitMsg('')
      setDiff(null)
      setSelectedPath(null)
      await refresh()
    } finally {
      setCommitting(false)
    }
  }

  if (!workspace) {
    return (
      <aside className="flex h-full w-[340px] shrink-0 flex-col items-center justify-center border-l border-line bg-rail p-4 text-center text-[11px] text-fg-3">
        No workspace selected
      </aside>
    )
  }

  if (!workspace.isGitRepo) {
    return (
      <aside className="flex h-full w-[340px] shrink-0 flex-col items-center justify-center border-l border-line bg-rail p-6 text-center">
        <Folder className="size-6 text-fg-3" />
        <p className="mt-2 text-[12px] font-medium text-fg">Not a Git repository</p>
        <p className="mt-1 text-[11px] text-fg-3">
          Git status, diffs, and worktrees are disabled for plain folders.
        </p>
      </aside>
    )
  }

  const changes = status?.changes ?? []

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-line bg-rail">
      <div className="flex h-9 items-center justify-between border-b border-line px-3">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-fg-3 uppercase">
          Changes ({changes.length})
        </span>
        <button
          type="button"
          title="Refresh Git status"
          onClick={() => void refresh()}
          className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
        >
          <RefreshCw className="size-3" />
        </button>
      </div>

      {mergePreview && (
        <div
          className={`flex items-center justify-between border-b border-line px-3 py-1.5 font-mono text-[10px] ${
            mergePreview.hasConflicts ? 'bg-fail/10 text-fail' : 'bg-done/10 text-done'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {mergePreview.hasConflicts ? (
              <AlertTriangle className="size-3" />
            ) : (
              <GitMerge className="size-3" />
            )}
            ↑{mergePreview.ahead} ↓{mergePreview.behind} vs {mergePreview.baseBranch}
          </span>
          <span>
            {mergePreview.hasConflicts
              ? `${mergePreview.conflictingFiles.length} conflicts`
              : 'Clean merge'}
          </span>
        </div>
      )}

      <div className="max-h-52 overflow-y-auto p-1.5">
        {changes.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-fg-3">Working tree clean</div>
        ) : (
          changes.map((c) => {
            const active = selectedPath === c.path
            return (
              <div
                key={c.path}
                onClick={() => void loadDiff(c.path, c.staged)}
                className={`group flex items-center gap-2 rounded px-2 py-1 text-[11px] cursor-pointer ${
                  active ? 'bg-cobalt/15 text-fg' : 'text-fg-2 hover:bg-white/[0.04]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={c.staged}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => void handleToggleStage(c.path, c.staged)}
                  className="size-3 accent-cobalt"
                />
                <span
                  className={`w-3 shrink-0 font-mono text-[10px] font-semibold ${
                    STATUS_COLORS[c.status] ?? 'text-fg-3'
                  }`}
                >
                  {c.status}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{c.path}</span>
                <button
                  type="button"
                  title="Open in external editor"
                  onClick={(e) => {
                    e.stopPropagation()
                    void openInEditor(editorPreset, `${workspace.path}/${c.path}`)
                  }}
                  className="rounded p-0.5 text-fg-3 opacity-0 hover:bg-white/[0.08] hover:text-fg group-hover:opacity-100 cursor-pointer"
                >
                  <ExternalLink className="size-3" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <UnifiedDiffView
          diff={diff}
          loading={loadingDiff}
          onOpenExternal={() => {
            if (selectedPath) {
              void openInEditor(editorPreset, `${workspace.path}/${selectedPath}`)
            }
          }}
        />
      </div>

      <div className="border-t border-line bg-rail p-2">
        <div className="flex gap-1.5">
          <input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                void handleCommit()
              }
            }}
            placeholder="Quick commit message..."
            className="min-w-0 flex-1 rounded-md border border-line bg-sunken px-2 py-1 text-[11px] text-fg placeholder:text-fg-3 focus:border-cobalt focus:outline-none"
          />
          <Btn
            variant="primary"
            disabled={!commitMsg.trim() || changes.length === 0 || committing}
            onClick={() => void handleCommit()}
          >
            <Check className="size-3" />
            Commit
          </Btn>
        </div>
      </div>
    </aside>
  )
}
