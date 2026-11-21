import { useState } from 'react'
import { Search, X } from 'lucide-react'
import type { HarnessSpec } from '../../types/ipc'
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
  const availableShells = useSettingsStore((s) => s.availableShells)
  const wslDistros = useSettingsStore((s) => s.wslDistros)
  const defaultShellId = useSettingsStore((s) => s.defaultShellId)

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('claude')
  const [extraArgsRaw, setExtraArgsRaw] = useState('')
  const [shellProfile, setShellProfile] = useState<string>(defaultShellId ?? '')
  const [resumeLatest, setResumeLatest] = useState(false)

  if (!open) return null

  const filtered = harnesses.filter(
    (h) =>
      h.enabled &&
      (h.name.toLowerCase().includes(query.toLowerCase()) ||
        h.command.toLowerCase().includes(query.toLowerCase())),
  )
  const activeHarness =
    filtered.find((h) => h.id === selectedId) ?? filtered[0] ?? harnesses[0]

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
          <h2 className="text-[13px] font-semibold text-fg">Launch CLI Harness</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-fg-3" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter 12 built-in & custom harnesses..."
              className="w-full rounded-md border border-line bg-sunken py-1.5 pr-3 pl-8 text-[12px] text-fg placeholder:text-fg-3 focus:border-cobalt focus:outline-none"
            />
          </div>

          <div className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto">
            {filtered.map((h) => {
              const selected = activeHarness?.id === h.id
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedId(h.id)}
                  onDoubleClick={submit}
                  className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-cobalt bg-cobalt/10'
                      : 'border-line bg-sunken/70 hover:border-line-strong hover:bg-hover/60'
                  }`}
                >
                  <HarnessGlyph harness={h} size={20} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-fg">{h.name}</div>
                    <div className="truncate font-mono text-[10px] text-fg-3">{h.command}</div>
                  </div>
                </button>
              )
            })}
          </div>

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
