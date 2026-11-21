import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { deleteCustomHarness, listHarnesses, upsertCustomHarness } from '../../lib/tauri'
import { Btn, HarnessGlyph } from '../ui/Primitives'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

type TabId = 'shells' | 'editor' | 'harnesses'

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const availableShells = useSettingsStore((s) => s.availableShells)
  const wslDistros = useSettingsStore((s) => s.wslDistros)
  const defaultShellId = useSettingsStore((s) => s.defaultShellId)
  const setDefaultShellId = useSettingsStore((s) => s.setDefaultShellId)
  const editorPreset = useSettingsStore((s) => s.editorPreset)
  const setEditorPreset = useSettingsStore((s) => s.setEditorPreset)

  const harnesses = useWorkspaceStore((s) => s.harnesses)
  const setHarnesses = useWorkspaceStore((s) => s.setHarnesses)

  const [tab, setTab] = useState<TabId>('shells')
  const [customEditorTemplate, setCustomEditorTemplate] = useState(
    editorPreset.kind === 'custom' ? editorPreset.template : 'nvim +{line} {path}',
  )
  const [newName, setNewName] = useState('')
  const [newCmd, setNewCmd] = useState('')

  if (!open) return null

  const handleAddHarness = async () => {
    if (!newName.trim() || !newCmd.trim()) return
    const id = newName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
    await upsertCustomHarness({
      id,
      name: newName.trim(),
      command: newCmd.trim(),
      defaultArgs: [],
      accentColor: '#05DCA3',
      enabled: true,
    })
    setHarnesses(await listHarnesses())
    setNewName('')
    setNewCmd('')
  }

  const handleDeleteHarness = async (id: string) => {
    await deleteCustomHarness(id)
    setHarnesses(await listHarnesses())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex h-[480px] w-full max-w-2xl animate-modal-in overflow-hidden rounded-lg border border-line-strong bg-raised shadow-2xl">
        <nav className="w-44 shrink-0 border-r border-line bg-rail p-2">
          <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-fg-3 uppercase">
            Settings
          </div>
          {(
            [
              ['shells', 'Shells & OS'],
              ['editor', 'External Editor'],
              ['harnesses', 'CLI Harnesses'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`mt-0.5 block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium cursor-pointer ${
                tab === id ? 'bg-cobalt/15 text-fg' : 'text-fg-2 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold text-fg">
              {tab === 'shells'
                ? 'Shells & OS Profiles'
                : tab === 'editor'
                  ? 'External Editor'
                  : 'CLI Harnesses'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {tab === 'shells' && (
              <>
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-fg-2">Default Login Shell</span>
                  <select
                    value={defaultShellId ?? ''}
                    onChange={(e) => setDefaultShellId(e.target.value || null)}
                    className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-fg"
                  >
                    {availableShells.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({s.program})
                      </option>
                    ))}
                    {wslDistros.map((d) => (
                      <option key={`wsl:${d}`} value={`wsl:${d}`}>
                        WSL2: {d}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-md border border-line bg-sunken p-3 text-[11px] text-fg-2">
                  Detected native shells: <strong className="text-fg">{availableShells.length}</strong>
                  {wslDistros.length > 0 && (
                    <span className="ml-3">
                      WSL2 distros: <strong className="text-fg">{wslDistros.join(', ')}</strong>
                    </span>
                  )}
                </div>
              </>
            )}

            {tab === 'editor' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['vsCode', 'VS Code (code --goto)'],
                      ['cursor', 'Cursor (cursor --goto)'],
                      ['zed', 'Zed (zed path:line:col)'],
                      ['custom', 'Custom Command Template'],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() =>
                        setEditorPreset(
                          kind === 'custom'
                            ? { kind: 'custom', template: customEditorTemplate }
                            : { kind },
                        )
                      }
                      className={`rounded-md border p-2.5 text-left text-[11px] font-medium cursor-pointer ${
                        editorPreset.kind === kind
                          ? 'border-cobalt bg-cobalt/15 text-fg'
                          : 'border-line bg-sunken text-fg-2 hover:border-line-strong'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {editorPreset.kind === 'custom' && (
                  <label className="block space-y-1">
                    <span className="text-[10px] text-fg-3">
                      Placeholders: <code>{'{path}'}</code>, <code>{'{line}'}</code>,{' '}
                      <code>{'{col}'}</code>
                    </span>
                    <input
                      value={customEditorTemplate}
                      onChange={(e) => {
                        setCustomEditorTemplate(e.target.value)
                        setEditorPreset({ kind: 'custom', template: e.target.value })
                      }}
                      className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-fg"
                    />
                  </label>
                )}
              </div>
            )}

            {tab === 'harnesses' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Custom harness name (e.g. Aider)"
                    className="flex-1 rounded-md border border-line bg-sunken px-2.5 py-1.5 text-[11px] text-fg"
                  />
                  <input
                    value={newCmd}
                    onChange={(e) => setNewCmd(e.target.value)}
                    placeholder="Command (e.g. aider)"
                    className="w-36 rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[11px] text-fg"
                  />
                  <Btn variant="primary" onClick={() => void handleAddHarness()}>
                    <Plus className="size-3" />
                    Add
                  </Btn>
                </div>

                <div className="space-y-1">
                  {harnesses.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded border border-line bg-sunken px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <HarnessGlyph harness={h} size={18} />
                        <span className="text-[11px] font-medium text-fg">{h.name}</span>
                        <span className="font-mono text-[10px] text-fg-3">{h.command}</span>
                      </div>
                      {!h.isBuiltin && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteHarness(h.id)}
                          className="rounded p-1 text-fg-3 hover:text-fail cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
