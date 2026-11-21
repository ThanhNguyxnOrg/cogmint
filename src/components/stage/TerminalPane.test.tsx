import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import * as tauriLib from '../../lib/tauri'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { TerminalPane } from './TerminalPane'

vi.mock('../../lib/tauri', async (importOriginal) => {
  const actual = await importOriginal<typeof tauriLib>()
  return {
    ...actual,
    spawnPanePty: vi.fn().mockResolvedValue(undefined),
    killPty: vi.fn().mockResolvedValue(undefined),
    writePty: vi.fn().mockResolvedValue(undefined),
    resizePty: vi.fn().mockResolvedValue(undefined),
  }
})

function PaneWrapper() {
  const pane = useWorkspaceStore((s) => s.panesById['pane-h1'])!
  return (
    <TerminalPane
      pane={pane}
      workspace={{
        id: 'ws-1',
        projectId: 'proj-1',
        name: 'main',
        path: '/repos/cogmint',
        branch: 'main',
        isGitRepo: true,
        isWorktree: false,
        shellProfile: null,
      }}
      harness={{
        id: 'claude',
        name: 'Claude Code',
        mono: 'CC',
        command: 'claude',
        defaultArgs: [],
        resumeStrategy: 'exactFlag',
        accentColor: '#D97757',
        isBuiltin: true,
        enabled: true,
      }}
    />
  )
}

test('hibernated pane renders resume prompt without spawning PTY until activated', async () => {
  const spawnMock = vi.mocked(tauriLib.spawnPanePty)
  spawnMock.mockClear()

  useWorkspaceStore.setState({
    panesById: {
      'pane-h1': {
        id: 'pane-h1',
        workspaceId: 'ws-1',
        harnessId: 'claude',
        title: 'Claude Code',
        pinned: false,
        resumeSessionId: 'sess-xyz',
        lastSummary: 'Refactored auth',
        customArgs: [],
        attentionState: 'hibernated',
        latestWords: 'Refactored auth',
        unread: false,
      },
    },
  })

  render(<PaneWrapper />)

  expect(screen.getByText('Refactored auth')).toBeInTheDocument()
  expect(spawnMock).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: /Resume Session/i }))

  await waitFor(() => {
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
  expect(spawnMock.mock.calls[0]?.[0]).toMatchObject({
    paneId: 'pane-h1',
    program: 'claude',
    args: ['--resume', 'sess-xyz'],
  })
})
