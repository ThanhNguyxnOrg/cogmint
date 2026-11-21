import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, RefreshCw, Search, X } from 'lucide-react'
import type { HarnessSpec } from '../../types/ipc'
import { listHarnesses } from '../../lib/tauri'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Btn, HarnessGlyph } from '../ui/Primitives'

interface LaunchHarnessModalProps {
  open: boolean
  onClose: () => void
  onLaunch: (opts: {
    harness: HarnessSpec
    extraArgs: string[]
    shellProfile: string | null
    resumeLatest: boolean
  }) => void
}

export function LaunchHarnessModal({ open, onClose, onLaunch }: LaunchHarnessModalProps) {
  const harnesses = useWorkspaceStore((s) => s.harnesses)
  const setHarnesses = useWorkspaceStore((s) => s.setHarnesses)
  const availableShells = useSettingsStore((s) => s.availableShells)
  const wslDistros = useSettingsStore((s) => s.wslDistros)
  const defaultShellId = useSettingsStore((s) => s.defaultShellId)

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [rescanning, setRescanning] = useState(false)
  const [extraArgsRaw, setExtraArgsRaw] = useState('')
  const [shellProfile, setShellProfile] = useState<string>(defaultShellId ?? '')
  const [resumeLatest, setResumeLatest] = useState(false)

  if (!open) return null

  const matchesQuery = (h: HarnessSpec) =>
    h.enabled &&
    (h.name.toLowerCase().includes(query.toLowerCase()) ||
      h.command.toLowerCase().includes(query.toLowerCase()))

  const installedList = harnesses.filter((h) => h.installed && matchesQuery(h))
  const unavailableList = harnesses.filter((h) => !h.installed && matchesQuery(h))

  const visibleSelectable = showUnavailable
    ? [...installedList, ...unavailableList]
    : installedList.length > 0
      ? installedList
      : unavailableList

  const activeHarness =
    visibleSelectable.find((h) => h.id === selectedId) ??
    installedList[0] ??
    visibleSelectable[0] ??
    null

  const handleRescan = async () => {
    setRescanning(true)
    try {
      const updated = await listHarnesses()
      if (updated.length > 0) setHarnesses(updated)
    } finally {
      setRescanning(false)
    }
  }

  const submit = () => {
    if (!activeHarness) return
    const extraArgs = extraArgsRaw
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    onLaunch({
      harness: activeHarness,
      extraArgs,
      shellProfile: shellProfile || null,
      resumeLatest,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl animate-modal-in rounded-lg border border-line-strong bg-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-fg">Launch CLI Harness</h2>
            <span className="rounded bg-done/15 px-1.5 py-0.5 font-mono text-[10px] text-done">
              {installedList.length} detected
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Re-scan installed CLIs"
              onClick={() => void handleRescan()}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
            >
              <RefreshCw className={`size-3 ${rescanning ? 'animate-spin' : ''}`} />
              Re-scan
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-fg-3" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter detected harnesses..."
              className="w-full rounded-md border border-line bg-sunken py-1.5 pr-3 pl-8 text-[12px] text-fg placeholder:text-fg-3 focus:border-cobalt focus:outline-none"
            />
          </div>

          {installedList.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold tracking-wider text-fg-3 uppercase">
                Installed on this machine
              </div>
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">
                {installedList.map((h) => {
                  const selected = activeHarness?.id === h.id
                  return (
                    <button
                      key={h.id}
                      type="button"
                      title={h.resolvedPath ?? h.command}
                      onClick={() => setSelectedId(h.id)}
                      onDoubleClick={submit}
                      className={`flex items-center gap-2.5 rounded-md border p-2.5 text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-cobalt bg-cobalt/12'
                          : 'border-line bg-sunken/80 hover:border-line-strong hover:bg-hover/60'
                      }`}
                    >
                      <HarnessGlyph harness={h} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-[11px] font-medium text-fg">{h.name}</span>
                          <CheckCircle2 className="size-2.5 shrink-0 text-done" />
                        </div>
                        <div className="truncate font-mono text-[10px] text-fg-3">{h.command}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-line-strong bg-sunken/70 p-4 text-center">
              <p className="text-[11px] font-medium text-fg">No supported AI CLIs detected on PATH</p>
              <p className="mt-1 text-[10px] text-fg-3">
                Install Claude Code, Codex, OpenCode, or Gemini CLI — or add a custom CLI in Settings.
              </p>
            </div>
          )}

          {unavailableList.length > 0 && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowUnavailable((v) => !v)}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-fg-3 hover:text-fg-2 cursor-pointer"
              >
                {showUnavailable ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                Not installed ({unavailableList.length})
              </button>

              {showUnavailable && (
                <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto">
                  {unavailableList.map((h) => {
                    const selected = activeHarness?.id === h.id
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedId(h.id)}
                        className={`flex items-center gap-2 rounded-md border p-2 text-left opacity-55 transition-all hover:opacity-85 cursor-pointer ${
                          selected
                            ? 'border-cobalt bg-cobalt/10 opacity-100'
                            : 'border-line bg-sunken/50'
                        }`}
                      >
                        <HarnessGlyph harness={h} size={22} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium text-fg-2">{h.name}</div>
                          <div className="truncate font-mono text-[10px] text-fg-3">{h.command}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[10px] font-medium text-fg-2">Shell Profile</span>
              <select
                value={shellProfile}
                onChange={(e) => setShellProfile(e.target.value)}
                className="w-full rounded-md border border-line bg-sunken px-2 py-1.5 font-mono text-[11px] text-fg"
              >
                <option value="">Default OS Shell</option>
                {availableShells.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
                {wslDistros.map((d) => (
                  <option key={`wsl:${d}`} value={`wsl:${d}`}>
                    WSL2: {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-medium text-fg-2">Extra CLI Args (optional)</span>
              <input
                value={extraArgsRaw}
                onChange={(e) => setExtraArgsRaw(e.target.value)}
                placeholder="e.g. --model opus"
                className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[11px] text-fg placeholder:text-fg-3"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-fg-2 cursor-pointer">
            <input
              type="checkbox"
              checked={resumeLatest}
              onChange={(e) => setResumeLatest(e.target.checked)}
              className="rounded border-line bg-sunken accent-cobalt"
            />
            Resume latest local session in this directory if available
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={submit} disabled={!activeHarness}>
            Launch {activeHarness?.name ?? 'Harness'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
