import { create } from 'zustand'
import type { AttentionState, HarnessSpec } from '../types/ipc'
import type {
  PaneRuntimeState,
  ProjectRecord,
  SplitDirection,
  SplitNode,
  WorkspaceJournalSnapshot,
  WorkspaceRecord,
} from '../types/workspace'
import {
  addTabToLeaf,
  closePaneFromTree,
  createLeaf,
  findLeafContainingPane,
  firstLeafId,
  reorderTabInLeaf,
  resizeSplitNode,
  setActiveTabInLeaf,
  splitLeaf,
} from '../lib/splitTree'

interface WorkspaceState {
  safeMode: boolean
  projects: ProjectRecord[]
  workspaces: WorkspaceRecord[]
  harnesses: HarnessSpec[]
  activeWorkspaceId: string | null
  focusedLeafId: string | null
  treesByWorkspaceId: Record<string, SplitNode | null>
  panesById: Record<string, PaneRuntimeState>

  setHarnesses: (harnesses: HarnessSpec[]) => void
  restoreFromJournal: (snapshot: WorkspaceJournalSnapshot) => void
  addProjectWithWorkspaces: (project: ProjectRecord, workspaces: WorkspaceRecord[]) => void
  addWorkspace: (workspace: WorkspaceRecord) => void
  removeWorkspace: (workspaceId: string) => void
  setActiveWorkspace: (workspaceId: string) => void
  setFocusedLeaf: (leafId: string | null) => void

  addPane: (
    workspaceId: string,
    pane: Omit<PaneRuntimeState, 'unread'>,
    splitDirection?: SplitDirection,
    targetLeafId?: string,
  ) => void
  closePane: (paneId: string) => void
  focusPane: (paneId: string) => void
  togglePinPane: (paneId: string) => void
  resizeSplit: (workspaceId: string, splitId: string, ratio: number) => void
  reorderTab: (workspaceId: string, leafId: string, fromIdx: number, toIdx: number) => void

  updatePaneAttention: (
    paneId: string,
    state: AttentionState,
    latestWords?: string | null,
  ) => void
  updatePaneResumeSession: (paneId: string, sessionId: string) => void
  jumpToNextAttention: () => string | null
}

const ATTENTION_PRIORITY: Record<AttentionState, number> = {
  needs_attention: 0,
  failed: 1,
  done: 2,
  working: 3,
  idle: 4,
  hibernated: 5,
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  safeMode: false,
  projects: [],
  workspaces: [],
  harnesses: [],
  activeWorkspaceId: null,
  focusedLeafId: null,
  treesByWorkspaceId: {},
  panesById: {},

  setHarnesses: (harnesses) => set({ harnesses }),

  restoreFromJournal: (snapshot) => {
    const missing = new Set(snapshot.missingPaths)
    const workspaces: WorkspaceRecord[] = snapshot.workspaces.map((ws) => ({
      ...ws,
      unavailable: missing.has(ws.path),
    }))

    // Crash-loop guard: in safeMode, skip auto-restoring layouts and panes
    if (snapshot.bootStatus.safeMode) {
      set({
        safeMode: true,
        projects: snapshot.projects,
        workspaces,
        panesById: {},
        treesByWorkspaceId: {},
        activeWorkspaceId: null,
        focusedLeafId: null,
      })
      return
    }

    const panesById: Record<string, PaneRuntimeState> = {}
    for (const p of snapshot.panes) {
      // Lazy / dormant restore: every restored pane starts hibernated
      panesById[p.id] = {
        ...p,
        attentionState: 'hibernated',
        latestWords: p.lastSummary,
        unread: false,
      }
    }

    const treesByWorkspaceId: Record<string, SplitNode | null> = {}
    for (const ws of workspaces) {
      const rawTree = snapshot.layouts[ws.id]
      if (rawTree) {
        try {
          treesByWorkspaceId[ws.id] = JSON.parse(rawTree) as SplitNode
          continue
        } catch {
          // fall through to default leaf
        }
      }
      const wsPanes = snapshot.panes.filter((p) => p.workspaceId === ws.id).map((p) => p.id)
      treesByWorkspaceId[ws.id] = wsPanes.length > 0 ? createLeaf(wsPanes) : null
    }

    const firstWs = workspaces.find((w) => !w.unavailable) ?? workspaces[0] ?? null
    const firstTree = firstWs ? treesByWorkspaceId[firstWs.id] ?? null : null

    set({
      safeMode: snapshot.bootStatus.safeMode,
      projects: snapshot.projects,
      workspaces,
      panesById,
      treesByWorkspaceId,
      activeWorkspaceId: firstWs?.id ?? null,
      focusedLeafId: firstTree ? firstLeafId(firstTree) : null,
    })
  },

  addProjectWithWorkspaces: (project, newWorkspaces) =>
    set((state) => {
      const projects = state.projects.some((p) => p.id === project.id)
        ? state.projects
        : [...state.projects, project]
      const existingIds = new Set(state.workspaces.map((w) => w.id))
      const workspaces = [
        ...state.workspaces,
        ...newWorkspaces.filter((w) => !existingIds.has(w.id)),
      ]
      const activeWorkspaceId = state.activeWorkspaceId ?? newWorkspaces[0]?.id ?? null
      return { projects, workspaces, activeWorkspaceId }
    }),

  addWorkspace: (workspace) =>
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
      activeWorkspaceId: workspace.id,
      focusedLeafId: null,
    })),

  removeWorkspace: (workspaceId) =>
    set((state) => {
      const workspaces = state.workspaces.filter((w) => w.id !== workspaceId)
      const treesByWorkspaceId = { ...state.treesByWorkspaceId }
      delete treesByWorkspaceId[workspaceId]
      const panesById = { ...state.panesById }
      for (const [id, pane] of Object.entries(panesById)) {
        if (pane.workspaceId === workspaceId) delete panesById[id]
      }
      const activeWorkspaceId =
        state.activeWorkspaceId === workspaceId ? (workspaces[0]?.id ?? null) : state.activeWorkspaceId
      return { workspaces, treesByWorkspaceId, panesById, activeWorkspaceId }
    }),

  setActiveWorkspace: (workspaceId) =>
    set((state) => {
      const tree = state.treesByWorkspaceId[workspaceId] ?? null
      return {
        activeWorkspaceId: workspaceId,
        focusedLeafId: tree ? firstLeafId(tree) : null,
      }
    }),

  setFocusedLeaf: (leafId) => set({ focusedLeafId: leafId }),

  addPane: (workspaceId, pane, splitDirection, targetLeafId) =>
    set((state) => {
      const panesById = {
        ...state.panesById,
        [pane.id]: { ...pane, unread: false },
      }
      const existingTree = state.treesByWorkspaceId[workspaceId] ?? null
      let nextTree: SplitNode
      if (!existingTree) {
        nextTree = createLeaf([pane.id], pane.id)
      } else {
        const leafId = targetLeafId ?? state.focusedLeafId ?? firstLeafId(existingTree)
        nextTree = splitDirection
          ? splitLeaf(existingTree, leafId, splitDirection, pane.id)
          : addTabToLeaf(existingTree, leafId, pane.id)
      }
      const newLeafId = findLeafContainingPane(nextTree, pane.id)
      return {
        panesById,
        activeWorkspaceId: workspaceId,
        focusedLeafId: newLeafId,
        treesByWorkspaceId: {
          ...state.treesByWorkspaceId,
          [workspaceId]: nextTree,
        },
      }
    }),

  closePane: (paneId) =>
    set((state) => {
      const pane = state.panesById[paneId]
      if (!pane) return state
      const panesById = { ...state.panesById }
      delete panesById[paneId]
      const tree = state.treesByWorkspaceId[pane.workspaceId] ?? null
      const nextTree = tree ? closePaneFromTree(tree, paneId) : null
      return {
        panesById,
        treesByWorkspaceId: {
          ...state.treesByWorkspaceId,
          [pane.workspaceId]: nextTree,
        },
        focusedLeafId: nextTree ? firstLeafId(nextTree) : null,
      }
    }),

  focusPane: (paneId) =>
    set((state) => {
      const pane = state.panesById[paneId]
      if (!pane) return state
      const tree = state.treesByWorkspaceId[pane.workspaceId] ?? null
      if (!tree) return { activeWorkspaceId: pane.workspaceId }
      const leafId = findLeafContainingPane(tree, paneId)
      const nextTree = leafId ? setActiveTabInLeaf(tree, leafId, paneId) : tree
      return {
        activeWorkspaceId: pane.workspaceId,
        focusedLeafId: leafId,
        treesByWorkspaceId: {
          ...state.treesByWorkspaceId,
          [pane.workspaceId]: nextTree,
        },
        panesById: {
          ...state.panesById,
          [paneId]: { ...pane, unread: false },
        },
      }
    }),

  togglePinPane: (paneId) =>
    set((state) => {
      const pane = state.panesById[paneId]
      if (!pane) return state
      const nextPinned = !pane.pinned
      const panesById = {
        ...state.panesById,
        [paneId]: { ...pane, pinned: nextPinned },
      }
      const tree = state.treesByWorkspaceId[pane.workspaceId] ?? null
      const leafId = tree ? findLeafContainingPane(tree, paneId) : null
      const pinnedSet = new Set(
        Object.values(panesById)
          .filter((p) => p.pinned)
          .map((p) => p.id),
      )
      const nextTree =
        tree && leafId ? reorderTabInLeaf(tree, leafId, 0, 0, pinnedSet) : tree
      return {
        panesById,
        treesByWorkspaceId: {
          ...state.treesByWorkspaceId,
          [pane.workspaceId]: nextTree,
        },
      }
    }),

  resizeSplit: (workspaceId, splitId, ratio) =>
    set((state) => {
      const tree = state.treesByWorkspaceId[workspaceId]
      if (!tree) return state
      return {
        treesByWorkspaceId: {
          ...state.treesByWorkspaceId,
          [workspaceId]: resizeSplitNode(tree, splitId, ratio),
        },
      }
    }),

  reorderTab: (workspaceId, leafId, fromIdx, toIdx) =>
    set((state) => {
      const tree = state.treesByWorkspaceId[workspaceId]
      if (!tree) return state
      const pinnedSet = new Set(
        Object.values(state.panesById)
          .filter((p) => p.pinned)
          .map((p) => p.id),
      )
      return {
        treesByWorkspaceId: {
          ...state.treesByWorkspaceId,
          [workspaceId]: reorderTabInLeaf(tree, leafId, fromIdx, toIdx, pinnedSet),
        },
      }
    }),

  updatePaneAttention: (paneId, nextState, latestWords) =>
    set((state) => {
      const pane = state.panesById[paneId]
      if (!pane) return state
      const tree = state.treesByWorkspaceId[state.activeWorkspaceId ?? ''] ?? null
      const findActiveInLeaf = (node: SplitNode | null, targetLeafId: string): string | null => {
        if (!node) return null
        if (node.type === 'leaf') return node.id === targetLeafId ? node.activePaneId : null
        return findActiveInLeaf(node.first, targetLeafId) ?? findActiveInLeaf(node.second, targetLeafId)
      }
      const isFocusedPane =
        pane.workspaceId === state.activeWorkspaceId &&
        tree !== null &&
        state.focusedLeafId !== null &&
        findLeafContainingPane(tree, paneId) === state.focusedLeafId &&
        findActiveInLeaf(tree, state.focusedLeafId) === paneId
      const shouldFlagUnread =
        !isFocusedPane &&
        (nextState === 'needs_attention' || nextState === 'failed' || nextState === 'done')

      return {
        panesById: {
          ...state.panesById,
          [paneId]: {
            ...pane,
            attentionState: nextState,
            latestWords: latestWords !== undefined ? latestWords : pane.latestWords,
            lastSummary: latestWords ?? pane.lastSummary,
            unread: pane.unread || shouldFlagUnread,
          },
        },
      }
    }),

  updatePaneResumeSession: (paneId, sessionId) =>
    set((state) => {
      const pane = state.panesById[paneId]
      if (!pane) return state
      return {
        panesById: {
          ...state.panesById,
          [paneId]: { ...pane, resumeSessionId: sessionId },
        },
      }
    }),

  jumpToNextAttention: () => {
    const state = get()
    const candidates = Object.values(state.panesById).filter(
      (p) => p.attentionState === 'needs_attention' || p.attentionState === 'failed' || p.unread,
    )
    if (candidates.length === 0) return null
    candidates.sort(
      (a, b) => ATTENTION_PRIORITY[a.attentionState] - ATTENTION_PRIORITY[b.attentionState],
    )
    const target = candidates[0]
    if (!target) return null
    get().focusPane(target.id)
    return target.id
  },
}))
