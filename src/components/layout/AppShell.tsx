import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  BellRing,
  ChartColumnBig,
  PanelRight,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import type { HarnessSpec } from '../../types/ipc'
import type { SplitDirection } from '../../types/workspace'
import type { UsageSummary } from '../../types/usage'
import {
  deleteProject,
  detectShells,
  getUsageSummary,
  listHarnesses,
  listWslDistros,
  loadWorkspaceJournal,
  markBootClean,
  pickDirectoryDialog,
  registerProject,
  resolveResumeSession,
  saveWorkspaceLayout,
  unwatchWorkspace,
  watchWorkspace,
} from '../../lib/tauri'
import type { SettingsTabId } from '../settings/SettingsModal'
import { isModKey } from '../../lib/keybindings'
import { Kbd, LogoMark } from '../ui/Primitives'
import { AttentionRail } from '../rail/AttentionRail'
import { SplitStage } from '../stage/SplitStage'
import { LaunchHarnessModal } from '../stage/LaunchHarnessModal'
import { StatusBar } from './StatusBar'
import { CommandPalette, type PaletteCommand } from './CommandPalette'

interface AppShellProps {
  rightDrawer?: ReactNode
  usageView?: (props: { summary: UsageSummary | null; onReload: () => void; onBack: () => void }) => ReactNode
  settingsModal?: (props: {
    open: boolean
    initialTab: SettingsTabId
    initialHarnessId: string | null
    onClose: () => void
    onRunLoginCommand: (harness: HarnessSpec) => void
  }) => ReactNode
  createWorktreeModal?: (props: {
    projectId: string | null
    onClose: () => void
  }) => ReactNode
}

export function AppShell({
  rightDrawer,
  usageView,
  settingsModal,
  createWorktreeModal,
}: AppShellProps) {
  const safeMode = useWorkspaceStore((s) => s.safeMode)
  const projects = useWorkspaceStore((s) => s.projects)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const panesById = useWorkspaceStore((s) => s.panesById)
  const treesByWorkspaceId = useWorkspaceStore((s) => s.treesByWorkspaceId)

  const setHarnesses = useWorkspaceStore((s) => s.setHarnesses)
  const restoreFromJournal = useWorkspaceStore((s) => s.restoreFromJournal)
  const addProjectWithWorkspaces = useWorkspaceStore((s) => s.addProjectWithWorkspaces)
  const removeProject = useWorkspaceStore((s) => s.removeProject)
  const addPane = useWorkspaceStore((s) => s.addPane)
  const jumpToNextAttention = useWorkspaceStore((s) => s.jumpToNextAttention)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)

  const setAvailableShells = useSettingsStore((s) => s.setAvailableShells)
  const setWslDistros = useSettingsStore((s) => s.setWslDistros)

  const [view, setView] = useState<'workspace' | 'usage'>('workspace')
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('auth')
  const [settingsHarnessId, setSettingsHarnessId] = useState<string | null>(null)
  const [worktreeProjectId, setWorktreeProjectId] = useState<string | null>(null)
  const [launchContext, setLaunchContext] = useState<{
    workspaceId: string
    splitDirection?: SplitDirection
    leafId?: string
  } | null>(null)
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null)

  const reloadUsage = useCallback(async () => {
    try {
      const summary = await getUsageSummary(30)
      setUsageSummary(summary)
    } catch {
      // Ignore usage load failures in headless environments
    }
  }, [])

  // Initial bootstrap: harnesses, shells, WSL distros, SQLite journal, and usage
  useEffect(() => {
    let active = true
    void (async () => {
      const [harnesses, shells, distros, journal] = await Promise.all([
        listHarnesses(),
        detectShells(),
        listWslDistros(),
        loadWorkspaceJournal(),
      ])
      if (!active) return
      if (harnesses.length > 0) setHarnesses(harnesses)
      setAvailableShells(shells)
      setWslDistros(distros)
      if (journal) {
        restoreFromJournal(journal)
      }
      void reloadUsage()
    })()
    const cleanTimer = setTimeout(() => {
      void markBootClean()
    }, 2000)
    return () => {
      active = false
      clearTimeout(cleanTimer)
    }
  }, [reloadUsage, restoreFromJournal, setAvailableShells, setHarnesses, setWslDistros])

  // Watch active workspace directory for Git changes and unwatch on switch
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.unavailable) return
    const wsId = activeWorkspace.id
    void watchWorkspace(wsId, activeWorkspace.path)
    return () => {
      void unwatchWorkspace(wsId)
    }
  }, [activeWorkspace])

  // Persist layout & panes to SQLite journal whenever active workspace tree/panes change
  useEffect(() => {
    if (!activeWorkspaceId) return
    const tree = treesByWorkspaceId[activeWorkspaceId] ?? null
    const wsPanes = Object.values(panesById)
      .filter((p) => p.workspaceId === activeWorkspaceId)
      .map((p) => ({
        id: p.id,
        workspaceId: p.workspaceId,
        harnessId: p.harnessId,
        title: p.title,
        pinned: p.pinned,
        resumeSessionId: p.resumeSessionId,
        lastSummary: p.lastSummary,
        customArgs: p.customArgs,
      }))
    void saveWorkspaceLayout(activeWorkspaceId, tree ? JSON.stringify(tree) : null, wsPanes)
  }, [activeWorkspaceId, panesById, treesByWorkspaceId])

  // 3-OS global keyboard shortcuts (capture phase so xterm focus does not swallow app shortcuts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isModKey(e)) return
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (key === 't' && activeWorkspaceId) {
        e.preventDefault()
        setLaunchContext({ workspaceId: activeWorkspaceId })
      } else if (key === 'd' && activeWorkspaceId) {
        e.preventDefault()
        setLaunchContext({
          workspaceId: activeWorkspaceId,
          splitDirection: e.shiftKey ? 'horizontal' : 'vertical',
        })
      } else if (e.shiftKey && key === 'a') {
        e.preventDefault()
        setView('workspace')
        jumpToNextAttention()
      } else if (e.shiftKey && key === 'b') {
        e.preventDefault()
        setDrawerOpen((v) => !v)
      } else if (e.shiftKey && key === 'u') {
        e.preventDefault()
        setView((v) => (v === 'usage' ? 'workspace' : 'usage'))
      } else if (key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [activeWorkspaceId, jumpToNextAttention])

  const handleAddProject = async () => {
    const dir = await pickDirectoryDialog()
    if (!dir) return
    const [proj, wts] = await registerProject(dir)
    addProjectWithWorkspaces(proj, wts)
  }

  const handleRemoveProject = async (projectId: string) => {
    await deleteProject(projectId)
    removeProject(projectId)
  }

  const openSettings = (tab: SettingsTabId = 'auth', harnessId: string | null = null) => {
    setSettingsTab(tab)
    setSettingsHarnessId(harnessId)
    setSettingsOpen(true)
  }

  const handleRunLoginCommand = (harness: HarnessSpec) => {
    const targetWs = activeWorkspace ?? workspaces[0] ?? null
    const loginCmd = harness.auth?.loginCommand ?? []
    if (!targetWs || loginCmd.length === 0) return
    const [program, ...args] = loginCmd
    const paneId = `auth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    addPane(targetWs.id, {
      id: paneId,
      workspaceId: targetWs.id,
      harnessId: harness.id,
      title: `Sign in: ${harness.name}`,
      pinned: false,
      resumeSessionId: null,
      lastSummary: null,
      customArgs: args,
      overrideProgram: program,
      skipDefaultArgs: true,
      attentionState: 'idle',
      latestWords: null,
    })
    setView('workspace')
  }

  const handleLaunchHarness = async (opts: {
    harness: HarnessSpec
    extraArgs: string[]
    shellProfile: string | null
    resumeLatest: boolean
  }) => {
    if (!launchContext) return
    const ws = workspaces.find((w) => w.id === launchContext.workspaceId)
    if (!ws) return

    let resumeId: string | null = null
    if (opts.resumeLatest) {
      resumeId = await resolveResumeSession(opts.harness.id, ws.path)
    }

    const paneId = `pane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    addPane(
      ws.id,
      {
        id: paneId,
        workspaceId: ws.id,
        harnessId: opts.harness.id,
        title: opts.harness.name,
        pinned: false,
        resumeSessionId: resumeId,
        lastSummary: null,
        customArgs: opts.extraArgs,
        attentionState: 'idle',
        latestWords: null,
      },
      launchContext.splitDirection,
      launchContext.leafId,
    )
    setView('workspace')
  }

  const attentionCount = Object.values(panesById).filter(
    (p) => p.attentionState === 'needs_attention' || p.attentionState === 'failed',
  ).length

  const activeProject = projects.find((p) => p.id === activeWorkspace?.projectId)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todaySpend = usageSummary?.byDay.find((d) => d.date === todayStr)?.costUsd ?? 0
  const todayTokens =
    (usageSummary?.totalInputTokens ?? 0) +
    (usageSummary?.totalOutputTokens ?? 0) +
    (usageSummary?.totalCacheReadTokens ?? 0)

  const paletteCommands: PaletteCommand[] = [
    {
      id: 'jump-attn',
      label: 'Jump to next pane needing attention',
      shortcut: '⌘⇧A',
      run: () => {
        setView('workspace')
        jumpToNextAttention()
      },
    },
    ...(activeWorkspaceId
      ? [
          {
            id: 'launch-harness',
            label: 'Launch CLI harness in current workspace',
            shortcut: '⌘T',
            run: () => setLaunchContext({ workspaceId: activeWorkspaceId }),
          },
        ]
      : []),
    {
      id: 'toggle-usage',
      label: 'Toggle Usage & Cost Dashboard',
      shortcut: '⌘⇧U',
      run: () => setView((v) => (v === 'usage' ? 'workspace' : 'usage')),
    },
    {
      id: 'toggle-drawer',
      label: 'Toggle Files & Git Changes Drawer',
      shortcut: '⌘⇧B',
      run: () => setDrawerOpen((v) => !v),
    },
    {
      id: 'open-settings',
      label: 'Open Settings',
      shortcut: '⌘,',
      run: () => setSettingsOpen(true),
    },
    ...workspaces.map((ws) => ({
      id: `ws-${ws.id}`,
      label: `Switch to ${ws.branch ?? ws.name}`,
      hint: ws.path,
      run: () => {
        setView('workspace')
        setActiveWorkspace(ws.id)
      },
    })),
  ]

  return (
    <main
      aria-label="COGMINT Workstation"
      className="flex h-screen w-screen flex-col overflow-hidden bg-canvas text-fg"
    >
      {/* Top Titlebar (36px) */}
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line bg-rail px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <LogoMark size={18} />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-fg">COGMINT</span>
          </div>
          {activeWorkspace && (
            <span className="truncate font-mono text-[11px] text-fg-3">
              {activeProject?.name} / {activeWorkspace.branch ?? activeWorkspace.name}
            </span>
          )}
          {safeMode && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-attn/15 px-1.5 py-0.5 text-[10px] text-attn">
              <ShieldAlert className="size-3" /> Safe Mode
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden h-6 w-56 shrink-0 items-center justify-between rounded-md border border-line bg-sunken px-2.5 text-[11px] text-fg-3 hover:border-line-strong hover:text-fg-2 lg:flex cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5">
            <Search className="size-3" />
            Search or run command...
          </span>
          <Kbd keys="⌘K" />
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setView('workspace')
              jumpToNextAttention()
            }}
            className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors cursor-pointer ${
              attentionCount > 0
                ? 'bg-attn/15 text-attn ring-1 ring-attn/30 hover:bg-attn/20'
                : 'text-fg-3 hover:bg-white/[0.05] hover:text-fg-2'
            }`}
          >
            <BellRing className="size-3" />
            <span>
              {attentionCount}
              <span className="hidden sm:inline"> Attention</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setView((v) => (v === 'usage' ? 'workspace' : 'usage'))}
            className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 font-mono text-[11px] tabular-nums transition-colors cursor-pointer ${
              view === 'usage'
                ? 'bg-cobalt/20 text-fg ring-1 ring-cobalt/40'
                : 'text-fg-2 hover:bg-white/[0.05] hover:text-fg'
            }`}
          >
            <ChartColumnBig className="size-3" />${todaySpend.toFixed(2)}
          </button>

          <button
            type="button"
            title="Toggle Files & Diff Drawer"
            onClick={() => setDrawerOpen((v) => !v)}
            className={`rounded p-1.5 transition-colors cursor-pointer ${
              drawerOpen ? 'bg-white/[0.07] text-fg' : 'text-fg-3 hover:bg-white/[0.05] hover:text-fg'
            }`}
          >
            <PanelRight className="size-3.5" />
          </button>

          <button
            type="button"
            title="Settings & Auth (Ctrl+,)"
            onClick={() => openSettings('auth')}
            className="rounded p-1.5 text-fg-3 hover:bg-white/[0.05] hover:text-fg cursor-pointer"
          >
            <Settings className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Main 3-Column Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AttentionRail
          width={260}
          onAddProject={() => void handleAddProject()}
          onRemoveProject={(projectId) => void handleRemoveProject(projectId)}
          onCreateWorktree={(projectId) => setWorktreeProjectId(projectId)}
          onLaunchAgent={(workspaceId) => setLaunchContext({ workspaceId })}
        />

        <div className={view === 'usage' ? 'hidden' : 'flex min-h-0 min-w-0 flex-1'}>
          <SplitStage
            workspace={activeWorkspace}
            onLaunchAgent={(workspaceId, splitDirection, leafId) =>
              setLaunchContext({ workspaceId, splitDirection, leafId })
            }
          />
        </div>

        {view === 'usage' &&
          usageView?.({
            summary: usageSummary,
            onReload: () => void reloadUsage(),
            onBack: () => setView('workspace'),
          })}

        {view === 'workspace' && drawerOpen && rightDrawer}
      </div>

      <StatusBar
        todaySpendUsd={todaySpend}
        todayTokens={todayTokens}
        onOpenUsage={() => setView((v) => (v === 'usage' ? 'workspace' : 'usage'))}
      />

      <LaunchHarnessModal
        open={launchContext !== null}
        onClose={() => setLaunchContext(null)}
        onLaunch={(opts) => void handleLaunchHarness(opts)}
        onOpenAuthSettings={(harnessId) => openSettings('auth', harnessId)}
        onRunLoginCommand={handleRunLoginCommand}
      />

      <CommandPalette
        open={paletteOpen}
        commands={paletteCommands}
        onClose={() => setPaletteOpen(false)}
      />

      {settingsModal?.({
        open: settingsOpen,
        initialTab: settingsTab,
        initialHarnessId: settingsHarnessId,
        onClose: () => setSettingsOpen(false),
        onRunLoginCommand: handleRunLoginCommand,
      })}
      {createWorktreeModal?.({
        projectId: worktreeProjectId,
        onClose: () => setWorktreeProjectId(null),
      })}
    </main>
  )
}
