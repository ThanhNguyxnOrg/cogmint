import { useWorkspaceStore } from './stores/useWorkspaceStore'
import { AppShell } from './components/layout/AppShell'
import { ChangesDrawer } from './components/git/ChangesDrawer'
import { CreateWorktreeModal } from './components/git/CreateWorktreeModal'
import { UsageDashboard } from './components/usage/UsageDashboard'
import { SettingsModal } from './components/settings/SettingsModal'

export default function App() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null

  return (
    <AppShell
      rightDrawer={<ChangesDrawer workspace={activeWorkspace} />}
      usageView={({ summary, onReload, onBack }) => (
        <UsageDashboard summary={summary} onReload={onReload} onBack={onBack} />
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
