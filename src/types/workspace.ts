import type { AttentionState, WorktreeInfo, WorktreeRecoveryReport } from './ipc'

export interface BootStatus {
  safeMode: boolean
  recentUncleanBoots: number
}

export interface ProjectRecord {
  id: string
  name: string
  rootPath: string
  isGitRepo: boolean
  createdAt: number
}

export interface WorkspaceRecord {
  id: string
  projectId: string
  name: string
  path: string
  branch: string | null
  isGitRepo: boolean
  isWorktree: boolean
  shellProfile: string | null
  unavailable?: boolean
}

export interface PaneJournalRecord {
  id: string
  workspaceId: string
  harnessId: string
  title: string
  pinned: boolean
  resumeSessionId: string | null
  lastSummary: string | null
  customArgs: string[]
}

export interface PaneRuntimeState extends PaneJournalRecord {
  attentionState: AttentionState
  latestWords: string | null
  unread: boolean
}

export type SplitDirection = 'horizontal' | 'vertical'

export type SplitNode =
  | {
      type: 'leaf'
      id: string
      paneIds: string[]
      activePaneId: string | null
    }
  | {
      type: 'split'
      id: string
      direction: SplitDirection
      ratio: number
      first: SplitNode
      second: SplitNode
    }

export interface WorkspaceJournalSnapshot {
  bootStatus: BootStatus
  projects: ProjectRecord[]
  workspaces: WorkspaceRecord[]
  panes: PaneJournalRecord[]
  layouts: Record<string, string>
  missingPaths: string[]
}

export interface CreateWorktreeResponse {
  ok: boolean
  workspace: WorkspaceRecord | null
  worktree: WorktreeInfo | null
  recovery: WorktreeRecoveryReport | null
}
