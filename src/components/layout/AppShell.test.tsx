import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Terminal } from '@xterm/xterm'
import { assert, vi } from 'vitest'
import * as tauri from '../../lib/tauri'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { AppShell } from './AppShell'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState())
})

test('switching workspaces preserves the running PTY and its background output', async () => {
  const spawn = vi.spyOn(tauri, 'spawnPanePty')
  const open = vi.spyOn(Terminal.prototype, 'open')
  const project = { id: 'proj', name: 'Project', rootPath: '/repo', isGitRepo: true, createdAt: 0 }
  const workspaces = ['main', 'feature'].map((id) => ({
    id,
    name: id,
    path: `/repo/${id}`,
    branch: id,
    projectId: project.id,
    isGitRepo: true,
    isWorktree: true,
    shellProfile: null,
  }))
  const store = useWorkspaceStore.getState()
  store.addProjectWithWorkspaces(project, workspaces)
  store.addPane('main', {
    id: 'term',
    workspaceId: 'main',
    title: 'Shell',
    harnessId: 'shell',
    pinned: false,
    customArgs: [],
    resumeSessionId: null,
    lastSummary: null,
    latestWords: null,
    attentionState: 'idle',
  })
  render(<AppShell />)
  const input = screen.getByRole('textbox', { name: 'Terminal input' })
  const term = open.mock.contexts[0]
  assert.instanceOf(term, Terminal)
  expect(spawn).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByText('feature'))
  expect(screen.getByRole('heading', { name: 'feature' })).toBeVisible()
  expect(screen.queryByRole('textbox', { name: 'Terminal input' })).not.toBeInTheDocument()
  spawn.mock.calls[0][1]({ event: 'output', data: { data: 'still running' } })
  fireEvent.click(screen.getByText('main'))

  expect(spawn).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('textbox', { name: 'Terminal input' })).toBe(input)
  await waitFor(() =>
    expect(term.buffer.active.getLine(0)?.translateToString(true)).toBe('still running'),
  )
})
