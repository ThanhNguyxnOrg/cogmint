import { useWorkspaceStore } from './useWorkspaceStore'

beforeEach(() => {
  useWorkspaceStore.setState({
    safeMode: false,
    projects: [],
    workspaces: [],
    harnesses: [],
    activeWorkspaceId: null,
    focusedLeafId: null,
    treesByWorkspaceId: {},
    panesById: {},
  })
})

test('test_restore_marks_missing_worktree_as_unavailable_without_throwing', () => {
  useWorkspaceStore.getState().restoreFromJournal({
    bootStatus: { safeMode: false, recentUncleanBoots: 0 },
    projects: [
      { id: 'proj-1', name: 'cogmint', rootPath: '/repos/cogmint', isGitRepo: true, createdAt: 1 },
    ],
    workspaces: [
      {
        id: 'ws-missing',
        projectId: 'proj-1',
        name: 'feat/deleted',
        path: '/repos/deleted-wt',
        branch: 'feat/deleted',
        isGitRepo: true,
        isWorktree: true,
        shellProfile: null,
      },
    ],
    panes: [
      {
        id: 'p-1',
        workspaceId: 'ws-missing',
        harnessId: 'claude',
        title: 'Claude Code',
        pinned: false,
        resumeSessionId: 'sess-1',
        lastSummary: 'Done editing',
        customArgs: [],
      },
    ],
    layouts: {},
    missingPaths: ['/repos/deleted-wt'],
  })

  const state = useWorkspaceStore.getState()
  expect(state.workspaces[0]?.unavailable).toBe(true)
  expect(state.panesById['p-1']?.attentionState).toBe('hibernated')
})

test('jumpToNextAttention focuses highest-priority needs_attention or failed pane and marks it read', () => {
  const store = useWorkspaceStore.getState()
  store.addProjectWithWorkspaces(
    { id: 'proj-1', name: 'cogmint', rootPath: '/repos/cogmint', isGitRepo: true, createdAt: 1 },
    [
      {
        id: 'ws-1',
        projectId: 'proj-1',
        name: 'main',
        path: '/repos/cogmint',
        branch: 'main',
        isGitRepo: true,
        isWorktree: false,
        shellProfile: null,
      },
    ],
  )
  store.addPane('ws-1', {
    id: 'p-work',
    workspaceId: 'ws-1',
    harnessId: 'codex',
    title: 'Codex',
    pinned: false,
    resumeSessionId: null,
    lastSummary: null,
    customArgs: [],
    attentionState: 'working',
    latestWords: 'Running tests',
  })
  store.addPane(
    'ws-1',
    {
      id: 'p-attn',
      workspaceId: 'ws-1',
      harnessId: 'claude',
      title: 'Claude Code',
      pinned: false,
      resumeSessionId: null,
      lastSummary: null,
      customArgs: [],
      attentionState: 'needs_attention',
      latestWords: 'Allow Bash? [y/N]',
    },
    'vertical',
  )
  store.focusPane('p-work')
  store.updatePaneAttention('p-attn', 'needs_attention', 'Allow Bash? [y/N]')

  const jumped = useWorkspaceStore.getState().jumpToNextAttention()
  expect(jumped).toBe('p-attn')
  expect(useWorkspaceStore.getState().panesById['p-attn']?.unread).toBe(false)
})

test('test_safe_mode_skips_auto_restoring_panes_and_layouts', () => {
  useWorkspaceStore.getState().restoreFromJournal({
    bootStatus: { safeMode: true, recentUncleanBoots: 2 },
    projects: [
      { id: 'proj-1', name: 'cogmint', rootPath: '/repos/cogmint', isGitRepo: true, createdAt: 1 },
    ],
    workspaces: [
      {
        id: 'ws-1',
        projectId: 'proj-1',
        name: 'main',
        path: '/repos/cogmint',
        branch: 'main',
        isGitRepo: true,
        isWorktree: false,
        shellProfile: null,
      },
    ],
    panes: [
      {
        id: 'p-1',
        workspaceId: 'ws-1',
        harnessId: 'claude',
        title: 'Claude Code',
        pinned: false,
        resumeSessionId: null,
        lastSummary: null,
        customArgs: [],
      },
    ],
    layouts: { 'ws-1': '{"type":"leaf","id":"l1","paneIds":["p-1"],"activePaneId":"p-1"}' },
    missingPaths: [],
  })

  const state = useWorkspaceStore.getState()
  expect(state.safeMode).toBe(true)
  expect(state.activeWorkspaceId).toBeNull()
  expect(Object.keys(state.panesById)).toHaveLength(0)
  expect(Object.keys(state.treesByWorkspaceId)).toHaveLength(0)
})
