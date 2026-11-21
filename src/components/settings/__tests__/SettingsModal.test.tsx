import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsModal } from '../SettingsModal'
import { useWorkspaceStore } from '../../../stores/useWorkspaceStore'

describe('SettingsModal Auth & API tab', () => {
  beforeEach(() => {
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
          resolvedPath: '/usr/local/bin/claude',
          auth: {
            status: 'unauthenticated',
            method: 'none',
            detail: null,
            loginCommand: ['claude', 'auth', 'login'],
            apiKeyEnv: 'ANTHROPIC_API_KEY',
            baseUrlEnv: 'ANTHROPIC_BASE_URL',
            supportsOauth: true,
            authNotes: 'Run claude auth login or set ANTHROPIC_API_KEY.',
          },
        },
        {
          id: 'codex',
          name: 'Codex CLI',
          mono: 'CX',
          command: 'codex',
          defaultArgs: [],
          resumeStrategy: 'exactFlag',
          accentColor: '#10A37F',
          isBuiltin: true,
          enabled: true,
          installed: true,
          resolvedPath: '/usr/local/bin/codex',
          auth: {
            status: 'authenticated',
            method: 'oauth_file',
            detail: '~/.codex/auth.json',
            loginCommand: ['codex', 'login'],
            apiKeyEnv: 'OPENAI_API_KEY',
            baseUrlEnv: 'OPENAI_BASE_URL',
            supportsOauth: true,
            authNotes: 'Run codex login or set OPENAI_API_KEY.',
          },
        },
      ],
    })
  })

  it('shows auth status, login command, and API key / base URL fields', () => {
    const onRunLoginCommand = vi.fn()
    const onClose = vi.fn()

    render(
      <SettingsModal
        open={true}
        initialTab="auth"
        initialHarnessId="claude"
        onClose={onClose}
        onRunLoginCommand={onRunLoginCommand}
      />,
    )

    expect(screen.getByText('Multi-Harness Auth & API Keys')).toBeTruthy()
    expect(screen.getByText('Not signed in')).toBeTruthy()
    expect(screen.getByText('ANTHROPIC_API_KEY')).toBeTruthy()
    expect(screen.getByText(/ANTHROPIC_BASE_URL/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Sign In in Terminal/i }))
    expect(onRunLoginCommand).toHaveBeenCalledTimes(1)
    expect(onRunLoginCommand.mock.calls[0]?.[0]?.id).toBe('claude')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
