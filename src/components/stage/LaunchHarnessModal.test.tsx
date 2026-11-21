import { fireEvent, render, screen } from '@testing-library/react'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { LaunchHarnessModal } from './LaunchHarnessModal'

test('LaunchHarnessModal shows only installed harnesses by default and hides uninstalled until toggled', () => {
  useWorkspaceStore.setState({
    harnesses: [
      {
        id: 'claude',
        name: 'Claude Code',
        mono: 'CC',
        command: 'claude',
        defaultArgs: [],
        resumeStrategy: 'exactFlag',
        accentColor: '#D97757',
        isBuiltin: true,
        enabled: true,
        installed: true,
        resolvedPath: 'C:\\Users\\Admin\\AppData\\Roaming\\npm\\claude.cmd',
      },
      {
        id: 'droid',
        name: 'Droid',
        mono: 'DR',
        command: 'droid',
        defaultArgs: [],
        resumeStrategy: 'bareRelaunch',
        accentColor: '#22D3EE',
        isBuiltin: true,
        enabled: true,
        installed: false,
        resolvedPath: null,
      },
    ],
  })

  render(<LaunchHarnessModal open={true} onClose={() => {}} onLaunch={() => {}} />)

  expect(screen.getByText('1 detected')).toBeInTheDocument()
  expect(screen.getByText('Claude Code')).toBeInTheDocument()
  expect(screen.queryByText('Droid')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Not installed \(1\)/i }))
  expect(screen.getByText('Droid')).toBeInTheDocument()
})
