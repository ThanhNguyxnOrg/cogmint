import { useState } from 'react'
import { AlertTriangle, GitBranchPlus, X } from 'lucide-react'
import type { WorktreeRecoveryReport } from '../../types/ipc'
import { createWorktree } from '../../lib/tauri'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { Btn } from '../ui/Primitives'

interface CreateWorktreeModalProps {
  projectId: string | null
  onClose: () => void
}

export function CreateWorktreeModal({ projectId, onClose }: CreateWorktreeModalProps) {
  const projects = useWorkspaceStore((s) => s.projects)
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace)

  const [branch, setBranch] = useState('')
  const [baseRef, setBaseRef] = useState('main')
  const [targetDir, setTargetDir] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recovery, setRecovery] = useState<WorktreeRecoveryReport | null>(null)

  if (!projectId) return null
  const project = projects.find((p) => p.id === projectId)
  if (!project) return null

  const submit = async () => {
    if (!branch.trim()) return
    setSubmitting(true)
    setRecovery(null)
    try {
      const res = await createWorktree(project.id, {
        repoRoot: project.rootPath,
        branch: branch.trim(),
        baseRef: baseRef.trim() || null,
        targetDir: targetDir.trim() || null,
      })
      if (res.ok && res.workspace) {
        addWorkspace(res.workspace)
        setBranch('')
        setTargetDir('')
        onClose()
      } else if (res.recovery) {
        setRecovery(res.recovery)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md animate-modal-in rounded-lg border border-line-strong bg-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <GitBranchPlus className="size-4 text-cobalt" />
            <h2 className="text-[13px] font-semibold text-fg">
              New Worktree — {project.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-[10px] font-medium text-fg-2">Branch Name</span>
            <input
              autoFocus
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feat/parallel-agents"
              className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-fg placeholder:text-fg-3 focus:border-cobalt focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-medium text-fg-2">Base Ref</span>
            <input
              value={baseRef}
              onChange={(e) => setBaseRef(e.target.value)}
              placeholder="main"
              className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-fg"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-medium text-fg-2">
              Target Directory (optional — defaults to sibling folder)
            </span>
            <input
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder="Auto-generated sibling directory"
              className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[11px] text-fg placeholder:text-fg-3"
            />
          </label>

          <p className="text-[10px] text-fg-3">
            Files listed in <code className="font-mono text-fg-2">.worktreeinclude</code> will be
            copied safely into the new checkout.
          </p>

          {recovery && (
            <div className="rounded-md border border-attn/40 bg-attn/10 p-3 text-[11px] text-attn">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-3.5" />
                Worktree Not Created (Safe Recovery)
              </div>
              <p className="mt-1 text-fg-2">{recovery.message}</p>
              <div className="mt-2 flex gap-3 font-mono text-[10px] text-fg-3">
                <span>branch_exists: {String(recovery.branchExists)}</span>
                <span>dir_exists: {String(recovery.dirExists)}</span>
                <span>registered: {String(recovery.registered)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={!branch.trim() || submitting} onClick={() => void submit()}>
            {submitting ? 'Creating...' : 'Create Worktree'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
