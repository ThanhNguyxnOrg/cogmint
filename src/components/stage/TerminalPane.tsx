import { useEffect, useRef } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { HarnessSpec } from '../../types/ipc'
import type { PaneRuntimeState, WorkspaceRecord } from '../../types/workspace'
import {
  killPty,
  notifyNative,
  openInEditor,
  resizePty,
  spawnPanePty,
  writePty,
} from '../../lib/tauri'
import { findFileLinks } from '../../lib/linkMatcher'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Btn, HarnessGlyph } from '../ui/Primitives'

interface TerminalPaneProps {
  pane: PaneRuntimeState
  workspace: WorkspaceRecord
  harness?: HarnessSpec
}

export function TerminalPane({ pane, workspace, harness }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const spawnedRef = useRef(false)

  const updatePaneAttention = useWorkspaceStore((s) => s.updatePaneAttention)
  const editorPreset = useSettingsStore((s) => s.editorPreset)
  const defaultShellId = useSettingsStore((s) => s.defaultShellId)

  const activateSession = async (fresh: boolean) => {
    if (spawnedRef.current) return
    spawnedRef.current = true
    updatePaneAttention(pane.id, 'working', pane.latestWords)

    const args: string[] = [...(harness?.defaultArgs ?? []), ...pane.customArgs]
    if (!fresh && pane.resumeSessionId && harness) {
      if (harness.id === 'claude') args.push('--resume', pane.resumeSessionId)
      else if (harness.id === 'codex') args.push('resume', pane.resumeSessionId)
      else if (harness.id === 'opencode') args.push('-s', pane.resumeSessionId)
      else if (harness.id === 'gemini') args.push('--resume', 'latest')
    }

    const cols = termRef.current?.cols ?? 100
    const rows = termRef.current?.rows ?? 30

    await spawnPanePty(
      {
        paneId: pane.id,
        cwd: workspace.path,
        cols,
        rows,
        program: harness?.command ?? null,
        args,
        shellProfile: workspace.shellProfile ?? defaultShellId,
      },
      (evt) => {
        if (evt.event === 'output') {
          termRef.current?.write(evt.data.data)
        } else if (evt.event === 'attention') {
          updatePaneAttention(pane.id, evt.data.state, evt.data.latestWords)
          if (
            typeof document !== 'undefined' &&
            !document.hasFocus() &&
            (evt.data.state === 'needs_attention' || evt.data.state === 'failed')
          ) {
            void notifyNative(
              `${pane.title} (${workspace.branch ?? workspace.name})`,
              evt.data.latestWords ?? `Agent ${evt.data.state.replace('_', ' ')}`,
            )
          }
        } else if (evt.event === 'exit') {
          spawnedRef.current = false
          const next = evt.data.exitCode === 0 || evt.data.exitCode === null ? 'done' : 'failed'
          updatePaneAttention(pane.id, next)
        }
      },
    )
  }

  useEffect(() => {
    // Lazy / dormant restore: NEVER spawn PTY while pane is hibernated
    if (pane.attentionState === 'hibernated') return
    const el = containerRef.current
    if (!el) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
      fontSize: 12,
      lineHeight: 1.4,
      theme: {
        background: '#090C12',
        foreground: '#F1F5F9',
        cursor: '#2F6FFF',
        selectionBackground: 'rgba(47, 111, 255, 0.35)',
      },
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(el)

    // WebGL with graceful fallback to default Canvas renderer
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      // Canvas renderer remains active
    }

    term.registerLinkProvider({
      provideLinks: (lineNumber, cb) => {
        const line = term.buffer.active.getLine(lineNumber - 1)?.translateToString() ?? ''
        const matches = findFileLinks(line)
        cb(
          matches.map((m) => ({
            text: m.raw,
            range: {
              start: { x: m.startIndex + 1, y: lineNumber },
              end: { x: m.endIndex, y: lineNumber },
            },
            activate: (_event, _text) => {
              void openInEditor(editorPreset, m.path, m.line, m.col)
            },
          })),
        )
      },
    })

    fit.fit()
    termRef.current = term

    const onDataDisp = term.onData((data) => {
      void writePty(pane.id, data)
    })

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            fit.fit()
            void resizePty(pane.id, term.cols, term.rows)
          })
        : null
    ro?.observe(el)

    void activateSession(false)

    return () => {
      onDataDisp.dispose()
      ro?.disconnect()
      term.dispose()
      termRef.current = null
      if (spawnedRef.current) {
        spawnedRef.current = false
        void killPty(pane.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane.id, pane.attentionState === 'hibernated'])

  if (pane.attentionState === 'hibernated') {
    return (
      <div
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void activateSession(false)
          }
        }}
        className="flex h-full w-full flex-col items-center justify-center bg-sunken p-6 text-center focus:outline-none"
      >
        <div className="w-full max-w-sm rounded-lg border border-line-strong bg-raised p-5">
          <div className="flex items-center justify-center gap-2">
            <HarnessGlyph harness={harness} size={22} />
            <span className="text-[13px] font-semibold text-fg">{pane.title}</span>
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-fg-3">
              Hibernated
            </span>
          </div>

          {pane.lastSummary && (
            <p className="mt-3 rounded border border-line bg-sunken px-3 py-2 font-mono text-[11px] text-fg-2">
              {pane.lastSummary}
            </p>
          )}

          {pane.resumeSessionId && (
            <p className="mt-2 font-mono text-[10px] text-fg-3">
              Session: {pane.resumeSessionId}
            </p>
          )}

          <div className="mt-4 flex items-center justify-center gap-2">
            <Btn variant="primary" onClick={() => void activateSession(false)}>
              <Play className="size-3" />
              Resume Session
            </Btn>
            <Btn variant="secondary" onClick={() => void activateSession(true)}>
              <RotateCcw className="size-3" />
              Start Fresh
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full bg-sunken p-1" />
}
