import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import * as tauriLib from '../../lib/tauri'
import { ChangesDrawer } from './ChangesDrawer'

vi.mock('../../lib/tauri', async (importOriginal) => {
  const actual = await importOriginal<typeof tauriLib>()
  return {
    ...actual,
    getGitStatus: vi.fn(),
    getFileDiff: vi.fn(),
  }
})

test('ChangesDrawer shows non-git empty state without calling git diff when workspace.isGitRepo is false', () => {
  const statusMock = vi.mocked(tauriLib.getGitStatus)
  statusMock.mockClear()

  render(
    <ChangesDrawer
      workspace={{
        id: 'ws-plain',
        projectId: 'proj-2',
        name: 'scratch-notes',
        path: '/tmp/notes',
        branch: null,
        isGitRepo: false,
        isWorktree: false,
        shellProfile: null,
      }}
    />,
  )

  expect(screen.getByText(/Not a Git repository/i)).toBeInTheDocument()
  expect(screen.queryByPlaceholderText(/Quick commit message/i)).not.toBeInTheDocument()
  expect(statusMock).not.toHaveBeenCalled()
})
