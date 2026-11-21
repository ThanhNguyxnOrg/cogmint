import { lazy, Suspense } from 'react'
import { useWorkspaceStore } from './stores/useWorkspaceStore'
import { AppShell } from './components/layout/AppShell'
import { ChangesDrawer } from './components/git/ChangesDrawer'
import { CreateWorktreeModal } from './components/git/CreateWorktreeModal'
import { SettingsModal } from './components/settings/SettingsModal'

const UsageDashboard = lazy(() =>
  import('./components/usage/UsageDashboard').then((m) => ({ default: m.UsageDashboard })),
)

export default function App() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null

  return (
    <AppShell
      rightDrawer={<ChangesDrawer workspace={activeWorkspace} />}
      usageView={({ summary, onReload, onBack }) => (
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center bg-canvas text-[12px] text-fg-3">
              Loading Usage & Cost Dashboard...
            </div>
          }
        >
          <UsageDashboard summary={summary} onReload={onReload} onBack={onBack} />
        </Suspense>
      )}
      settingsModal={({ open, initialTab, initialHarnessId, onClose, onRunLoginCommand }) => (
        <SettingsModal
          open={open}
          initialTab={initialTab}
          initialHarnessId={initialHarnessId}
          onClose={onClose}
          onRunLoginCommand={onRunLoginCommand}
        />
      )}
      createWorktreeModal={({ projectId, onClose }) => (
        <CreateWorktreeModal projectId={projectId} onClose={onClose} />
      )}
    />
  )
}
