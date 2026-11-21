import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Download,
  KeyRound,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { CustomHarnessRecord, HarnessAuthProfileSummary, HarnessSpec } from '../../types/ipc'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import {
  clearHarnessAuthProfile,
  deleteCustomHarness,
  listHarnessAuthProfiles,
  listHarnesses,
  saveHarnessAuthProfile,
  upsertCustomHarness,
} from '../../lib/tauri'
import { Btn, HarnessGlyph } from '../ui/Primitives'
import { HarnessLogo, LOGO_PRESET_IDS } from '../ui/HarnessLogo'

const ACCENT_SWATCHES = [
  '#05DCA3',
  '#2F6FFF',
  '#D97757',
  '#10A37F',
  '#A855F7',
  '#F97316',
  '#38BDF8',
  '#EC4899',
  '#FACC15',
  '#F8FAFC',
]

const QUICK_CUSTOM_TEMPLATES = [
  { name: 'Windsurf CLI', command: 'windsurf', args: '', iconId: 'windsurf', color: '#05DCA3' },
  { name: 'Trae CLI', command: 'trae', args: '', iconId: 'trae', color: '#38BDF8' },
  { name: 'Crush', command: 'crush', args: '', iconId: '', color: '#EC4899' },
  { name: 'OpenInterpreter', command: 'interpreter', args: '', iconId: '', color: '#FACC15' },
]

export type SettingsTabId = 'auth' | 'shells' | 'editor' | 'harnesses'

interface SettingsModalProps {
  open: boolean
  initialTab?: SettingsTabId
  initialHarnessId?: string | null
  onClose: () => void
  onRunLoginCommand?: (harness: HarnessSpec) => void
}

interface EnvPair {
  key: string
  value: string
}

export function SettingsModal({
  open,
  initialTab = 'auth',
  initialHarnessId = null,
  onClose,
  onRunLoginCommand,
}: SettingsModalProps) {
  const availableShells = useSettingsStore((s) => s.availableShells)
  const wslDistros = useSettingsStore((s) => s.wslDistros)
  const defaultShellId = useSettingsStore((s) => s.defaultShellId)
  const setDefaultShellId = useSettingsStore((s) => s.setDefaultShellId)
  const editorPreset = useSettingsStore((s) => s.editorPreset)
  const setEditorPreset = useSettingsStore((s) => s.setEditorPreset)

  const harnesses = useWorkspaceStore((s) => s.harnesses)
  const setHarnesses = useWorkspaceStore((s) => s.setHarnesses)

  const [tab, setTab] = useState<SettingsTabId>(initialTab)
  const [selectedHarnessId, setSelectedHarnessId] = useState<string>(initialHarnessId ?? '')
  const [profilesById, setProfilesById] = useState<Record<string, HarnessAuthProfileSummary>>({})
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [baseUrlInput, setBaseUrlInput] = useState('')
  const [useCustomEnv, setUseCustomEnv] = useState(false)
  const [extraEnvRows, setExtraEnvRows] = useState<EnvPair[]>([])
  const [savingAuth, setSavingAuth] = useState(false)
  const [authSavedNotice, setAuthSavedNotice] = useState<string | null>(null)
  const [rechecking, setRechecking] = useState(false)

  const [customEditorTemplate, setCustomEditorTemplate] = useState(
    editorPreset.kind === 'custom' ? editorPreset.template : 'nvim +{line} {path}',
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newCmd, setNewCmd] = useState('')
  const [newArgs, setNewArgs] = useState('')
  const [newAccent, setNewAccent] = useState('#05DCA3')
  const [newIconId, setNewIconId] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [harnessNotice, setHarnessNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    if (initialHarnessId) {
      setSelectedHarnessId(initialHarnessId)
    }
    void (async () => {
      const profiles = await listHarnessAuthProfiles()
      setProfilesById(Object.fromEntries(profiles.map((p) => [p.harnessId, p])))
    })()
  }, [open, initialTab, initialHarnessId])

  const activeHarness =
    harnesses.find((h) => h.id === selectedHarnessId) ??
    harnesses.find((h) => h.installed) ??
    harnesses[0] ??
    null

  useEffect(() => {
    if (!activeHarness) return
    const prof = profilesById[activeHarness.id]
    setApiKeyInput('')
    setBaseUrlInput(prof?.baseUrl ?? '')
    setUseCustomEnv(prof?.useCustomEnv ?? false)
    setExtraEnvRows(
      prof
        ? Object.entries(prof.extraEnv).map(([key, value]) => ({ key, value }))
        : [],
    )
    setAuthSavedNotice(null)
  }, [activeHarness?.id, profilesById])

  if (!open) return null

  const activeProfile = activeHarness ? profilesById[activeHarness.id] : undefined

  const handleRecheckAuth = async () => {
    setRechecking(true)
    try {
      const [updated, profiles] = await Promise.all([
        listHarnesses(),
        listHarnessAuthProfiles(),
      ])
      if (updated.length > 0) setHarnesses(updated)
      setProfilesById(Object.fromEntries(profiles.map((p) => [p.harnessId, p])))
    } finally {
      setRechecking(false)
    }
  }

  const handleSaveAuth = async (clearApiKey = false) => {
    if (!activeHarness) return
    setSavingAuth(true)
    setAuthSavedNotice(null)
    try {
      const extraEnv: Record<string, string> = {}
      for (const row of extraEnvRows) {
        const k = row.key.trim()
        if (k) extraEnv[k] = row.value
      }
      const hasAnyCustom =
        (!clearApiKey && (apiKeyInput.trim().length > 0 || activeProfile?.hasApiKey)) ||
        baseUrlInput.trim().length > 0 ||
        Object.keys(extraEnv).length > 0
      const nextUseCustom = clearApiKey ? useCustomEnv : useCustomEnv || hasAnyCustom

      const summary = await saveHarnessAuthProfile({
        harnessId: activeHarness.id,
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : null,
        clearApiKey,
        baseUrl: baseUrlInput.trim() ? baseUrlInput.trim() : null,
        extraEnv,
        useCustomEnv: nextUseCustom,
      })
      if (summary) {
        setProfilesById((prev) => ({ ...prev, [summary.harnessId]: summary }))
      }
      setApiKeyInput('')
      const updated = await listHarnesses()
      if (updated.length > 0) setHarnesses(updated)
      setAuthSavedNotice(clearApiKey ? 'Stored API key cleared' : 'Auth profile saved')
    } finally {
      setSavingAuth(false)
    }
  }

  const handleResetAuthProfile = async () => {
    if (!activeHarness) return
    setSavingAuth(true)
    try {
      await clearHarnessAuthProfile(activeHarness.id)
      setProfilesById((prev) => {
        const next = { ...prev }
        delete next[activeHarness.id]
        return next
      })
      setApiKeyInput('')
      setBaseUrlInput('')
      setUseCustomEnv(false)
      setExtraEnvRows([])
      const updated = await listHarnesses()
      if (updated.length > 0) setHarnesses(updated)
      setAuthSavedNotice('Reset to default CLI auth')
    } finally {
      setSavingAuth(false)
    }
  }

  const resetHarnessForm = () => {
    setEditingId(null)
    setNewName('')
    setNewCmd('')
    setNewArgs('')
    setNewAccent('#05DCA3')
    setNewIconId('')
  }

  const handleSaveHarness = async () => {
    if (!newName.trim() || !newCmd.trim()) return
    const id =
      editingId ??
      newName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    if (!id) return
    const defaultArgs = newArgs
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    await upsertCustomHarness({
      id,
      name: newName.trim(),
      command: newCmd.trim(),
      defaultArgs,
      accentColor: newAccent,
      enabled: true,
      iconId: newIconId.trim() || null,
    })
    setHarnesses(await listHarnesses())
    setHarnessNotice(editingId ? `Updated ${newName.trim()}` : `Added ${newName.trim()}`)
    resetHarnessForm()
  }

  const handleEditHarness = (h: HarnessSpec) => {
    setEditingId(h.id)
    setNewName(h.name)
    setNewCmd(h.command)
    setNewArgs(h.defaultArgs.join(' '))
    setNewAccent(h.accentColor)
    setNewIconId(h.iconId ?? '')
    setHarnessNotice(null)
  }

  const handleToggleHarnessEnabled = async (h: HarnessSpec) => {
    await upsertCustomHarness({
      id: h.id,
      name: h.name,
      command: h.command,
      defaultArgs: h.defaultArgs,
      accentColor: h.accentColor,
      enabled: !h.enabled,
      iconId: h.iconId ?? null,
    })
    setHarnesses(await listHarnesses())
  }

  const handleDeleteHarness = async (id: string) => {
    await deleteCustomHarness(id)
    setHarnesses(await listHarnesses())
    if (editingId === id) resetHarnessForm()
  }

  const handleExportCustomHarnesses = async () => {
    const customOnly: CustomHarnessRecord[] = harnesses
      .filter((h) => !h.isBuiltin)
      .map((h) => ({
        id: h.id,
        name: h.name,
        command: h.command,
        defaultArgs: h.defaultArgs,
        accentColor: h.accentColor,
        enabled: h.enabled,
        iconId: h.iconId ?? null,
      }))
    const json = JSON.stringify(customOnly, null, 2)
    try {
      await navigator.clipboard.writeText(json)
      setHarnessNotice(`Copied ${customOnly.length} custom harness(es) JSON to clipboard`)
    } catch {
      setImportJson(json)
      setImportOpen(true)
      setHarnessNotice('Ready to copy JSON below')
    }
  }

  const handleImportCustomHarnesses = async () => {
    try {
      const parsed = JSON.parse(importJson) as CustomHarnessRecord[]
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array')
      let count = 0
      for (const item of parsed) {
        if (!item?.id || !item?.name || !item?.command) continue
        await upsertCustomHarness({
          id: String(item.id),
          name: String(item.name),
          command: String(item.command),
          defaultArgs: Array.isArray(item.defaultArgs) ? item.defaultArgs.map(String) : [],
          accentColor: item.accentColor || '#05DCA3',
          enabled: item.enabled !== false,
          iconId: item.iconId ?? null,
        })
        count++
      }
      setHarnesses(await listHarnesses())
      setImportOpen(false)
      setImportJson('')
      setHarnessNotice(`Imported ${count} harness(es)`)
    } catch {
      setHarnessNotice('Invalid JSON — expected array of { id, name, command, defaultArgs }')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex h-[min(560px,90vh)] w-full max-w-3xl animate-modal-in overflow-hidden rounded-lg border border-line-strong bg-raised shadow-2xl">
        <nav className="w-44 shrink-0 border-r border-line bg-rail p-2">
          <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-fg-3 uppercase">
            Settings
          </div>
          {(
            [
              ['auth', 'Auth & API Keys'],
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
              {tab === 'auth'
                ? 'Multi-Harness Auth & API Keys'
                : tab === 'shells'
                  ? 'Shells & OS Profiles'
                  : tab === 'editor'
                    ? 'External Editor'
                    : 'CLI Harnesses'}
            </h2>
            <div className="flex items-center gap-1.5">
              {tab === 'auth' && (
                <button
                  type="button"
                  onClick={() => void handleRecheckAuth()}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
                >
                  <RefreshCw className={`size-3 ${rechecking ? 'animate-spin' : ''}`} />
                  Re-check Auth
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'auth' && (
              <div className="flex h-full min-h-[420px] gap-3">
                {/* Harness selector list */}
                <div className="w-44 shrink-0 space-y-1 overflow-y-auto pr-1">
                  {harnesses.map((h) => {
                    const selected = activeHarness?.id === h.id
                    const isAuthed = h.auth?.status === 'authenticated'
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedHarnessId(h.id)}
                        className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-cobalt bg-cobalt/15 text-fg'
                            : 'border-transparent bg-sunken/60 text-fg-2 hover:bg-hover/60'
                        }`}
                      >
                        <HarnessGlyph harness={h} size={18} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium">{h.name}</div>
                          <div className="truncate font-mono text-[9px] text-fg-3">
                            {h.installed ? 'Installed' : 'Not installed'}
                          </div>
                        </div>
                        <span
                          title={isAuthed ? h.auth?.detail ?? 'Authenticated' : 'Not signed in'}
                          className={`size-2 shrink-0 rounded-full ${
                            isAuthed ? 'bg-done' : 'bg-attn/70'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>

                {/* Selected harness auth editor */}
                {activeHarness ? (
                  <div className="min-w-0 flex-1 space-y-3 overflow-y-auto rounded-md border border-line bg-sunken/70 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <HarnessGlyph harness={activeHarness} size={26} />
                        <div>
                          <div className="text-[12px] font-semibold text-fg">
                            {activeHarness.name}
                          </div>
                          <div className="font-mono text-[10px] text-fg-3">
                            {activeHarness.command}
                          </div>
                        </div>
                      </div>

                      {activeHarness.auth?.status === 'authenticated' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-done/15 px-2 py-0.5 text-[10px] font-medium text-done">
                          <CheckCircle2 className="size-3" />
                          {activeHarness.auth.detail ?? 'Signed in'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-attn/15 px-2 py-0.5 text-[10px] font-medium text-attn">
                          <ShieldAlert className="size-3" />
                          Not signed in
                        </span>
                      )}
                    </div>

                    {activeHarness.auth?.authNotes && (
                      <p className="text-[11px] leading-relaxed text-fg-2">
                        {activeHarness.auth.authNotes}
                      </p>
                    )}

                    {/* Interactive OAuth / CLI Login */}
                    {activeHarness.auth && activeHarness.auth.loginCommand.length > 0 && (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-raised px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-fg">
                            Interactive CLI Sign-In (OAuth / Subscription)
                          </div>
                          <code className="block truncate font-mono text-[10px] text-fg-3">
                            $ {activeHarness.auth.loginCommand.join(' ')}
                          </code>
                        </div>
                        <Btn
                          variant="primary"
                          onClick={() => {
                            onRunLoginCommand?.(activeHarness)
                            onClose()
                          }}
                          disabled={!onRunLoginCommand}
                        >
                          <LogIn className="size-3" />
                          Sign In in Terminal
                        </Btn>
                      </div>
                    )}

                    {/* API Key & Custom Proxy Env Override */}
                    <div className="space-y-3 rounded-md border border-line bg-raised p-3">
                      <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-fg cursor-pointer">
                        <span className="inline-flex items-center gap-1.5">
                          <KeyRound className="size-3.5 text-cobalt" />
                          Inject COGMINT API Key / Custom Env on Launch
                        </span>
                        <input
                          type="checkbox"
                          checked={useCustomEnv}
                          onChange={(e) => setUseCustomEnv(e.target.checked)}
                          className="rounded border-line bg-sunken accent-cobalt"
                        />
                      </label>

                      {activeHarness.auth?.apiKeyEnv && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-fg-2">
                              {activeHarness.auth.apiKeyEnv}
                            </span>
                            {activeProfile?.hasApiKey && (
                              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-done">
                                Saved: {activeProfile.apiKeyPreview}
                                <button
                                  type="button"
                                  onClick={() => void handleSaveAuth(true)}
                                  className="text-fg-3 underline hover:text-fail cursor-pointer"
                                >
                                  Clear
                                </button>
                              </span>
                            )}
                          </div>
                          <input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder={
                              activeProfile?.hasApiKey
                                ? 'Leave blank to keep saved key, or paste new key...'
                                : `Paste ${activeHarness.auth.apiKeyEnv}...`
                            }
                            className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[11px] text-fg placeholder:text-fg-3 focus:border-cobalt focus:outline-none"
                          />
                        </div>
                      )}

                      {activeHarness.auth?.baseUrlEnv && (
                        <div className="space-y-1">
                          <span className="font-mono text-[10px] text-fg-2">
                            {activeHarness.auth.baseUrlEnv} (optional proxy / gateway)
                          </span>
                          <input
                            type="url"
                            value={baseUrlInput}
                            onChange={(e) => setBaseUrlInput(e.target.value)}
                            placeholder="https://api.example.com/v1"
                            className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[11px] text-fg placeholder:text-fg-3 focus:border-cobalt focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Extra Env Vars */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-fg-2">
                            Extra Environment Variables (e.g. ANTHROPIC_AUTH_TOKEN, HTTP_PROXY)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExtraEnvRows((rows) => [...rows, { key: '', value: '' }])
                            }
                            className="inline-flex items-center gap-0.5 text-[10px] text-cobalt hover:underline cursor-pointer"
                          >
                            <Plus className="size-3" /> Add Var
                          </button>
                        </div>

                        {extraEnvRows.map((row, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              value={row.key}
                              onChange={(e) =>
                                setExtraEnvRows((rows) =>
                                  rows.map((r, i) =>
                                    i === idx ? { ...r, key: e.target.value } : r,
                                  ),
                                )
                              }
                              placeholder="ENV_KEY"
                              className="w-40 rounded border border-line bg-sunken px-2 py-1 font-mono text-[10px] text-fg"
                            />
                            <input
                              value={row.value}
                              onChange={(e) =>
                                setExtraEnvRows((rows) =>
                                  rows.map((r, i) =>
                                    i === idx ? { ...r, value: e.target.value } : r,
                                  ),
                                )
                              }
                              placeholder="value"
                              className="min-w-0 flex-1 rounded border border-line bg-sunken px-2 py-1 font-mono text-[10px] text-fg"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setExtraEnvRows((rows) => rows.filter((_, i) => i !== idx))
                              }
                              className="rounded p-1 text-fg-3 hover:text-fail cursor-pointer"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-done">{authSavedNotice ?? ''}</span>
                        <div className="flex items-center gap-2">
                          {activeProfile && (
                            <Btn
                              variant="ghost"
                              onClick={() => void handleResetAuthProfile()}
                              disabled={savingAuth}
                            >
                              Reset
                            </Btn>
                          )}
                          <Btn
                            variant="primary"
                            onClick={() => void handleSaveAuth(false)}
                            disabled={savingAuth}
                          >
                            {savingAuth ? 'Saving...' : 'Save Auth Profile'}
                          </Btn>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-fg-3">
                      Stored locally in COGMINT SQLite only. Injected strictly into spawned PTY
                      processes — never modifies your external CLI config files.
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {tab === 'shells' && (
              <div className="space-y-4">
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
              </div>
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
                {/* Add / Edit Custom Harness Builder */}
                <div className="space-y-2.5 rounded-md border border-line bg-sunken/80 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-fg">
                      {editingId ? `Edit Harness (${editingId})` : 'Add Any Custom CLI Harness'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleExportCustomHarnesses()}
                        className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-fg-2 hover:bg-hover hover:text-fg cursor-pointer"
                      >
                        <Download className="size-2.5" /> Export JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportOpen((v) => !v)}
                        className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-fg-2 hover:bg-hover hover:text-fg cursor-pointer"
                      >
                        <Upload className="size-2.5" /> Import JSON
                      </button>
                    </div>
                  </div>

                  {/* Quick templates */}
                  {!editingId && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-fg-3">Quick add:</span>
                      {QUICK_CUSTOM_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.command}
                          type="button"
                          onClick={() => {
                            setNewName(tpl.name)
                            setNewCmd(tpl.command)
                            setNewArgs(tpl.args)
                            setNewIconId(tpl.iconId)
                            setNewAccent(tpl.color)
                          }}
                          className="rounded border border-line bg-raised px-1.5 py-0.5 text-[10px] text-fg-2 hover:border-cobalt hover:text-fg cursor-pointer"
                        >
                          + {tpl.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Display name (e.g. Crush)"
                      className="rounded-md border border-line bg-raised px-2.5 py-1.5 text-[11px] text-fg"
                    />
                    <input
                      value={newCmd}
                      onChange={(e) => setNewCmd(e.target.value)}
                      placeholder="Command or full path"
                      className="rounded-md border border-line bg-raised px-2.5 py-1.5 font-mono text-[11px] text-fg"
                    />
                    <input
                      value={newArgs}
                      onChange={(e) => setNewArgs(e.target.value)}
                      placeholder="Default args (optional)"
                      className="rounded-md border border-line bg-raised px-2.5 py-1.5 font-mono text-[11px] text-fg"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-fg-3">Logo:</span>
                      <select
                        value={newIconId}
                        onChange={(e) => setNewIconId(e.target.value)}
                        className="rounded border border-line bg-raised px-2 py-1 text-[10px] text-fg"
                      >
                        <option value="">Default Terminal</option>
                        {LOGO_PRESET_IDS.map((pid) => (
                          <option key={pid} value={pid}>
                            {pid}
                          </option>
                        ))}
                      </select>
                      <span className="inline-grid size-6 place-items-center rounded border border-line bg-raised">
                        <HarnessLogo id={newIconId || undefined} accentColor={newAccent} size={14} />
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {ACCENT_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewAccent(c)}
                          className={`size-4 rounded-full cursor-pointer ${
                            newAccent === c ? 'ring-2 ring-white ring-offset-1 ring-offset-sunken' : ''
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {editingId && (
                        <Btn variant="ghost" onClick={resetHarnessForm}>
                          Cancel
                        </Btn>
                      )}
                      <Btn variant="primary" onClick={() => void handleSaveHarness()}>
                        <Plus className="size-3" />
                        {editingId ? 'Save Changes' : 'Add Harness'}
                      </Btn>
                    </div>
                  </div>

                  {importOpen && (
                    <div className="space-y-1.5 pt-1">
                      <textarea
                        rows={4}
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        placeholder='[{"id":"crush","name":"Crush","command":"crush","defaultArgs":[],"accentColor":"#EC4899","enabled":true}]'
                        className="w-full rounded border border-line bg-raised p-2 font-mono text-[10px] text-fg"
                      />
                      <div className="flex justify-end gap-1.5">
                        <Btn variant="ghost" onClick={() => setImportOpen(false)}>
                          Close
                        </Btn>
                        <Btn variant="primary" onClick={() => void handleImportCustomHarnesses()}>
                          Import Harnesses
                        </Btn>
                      </div>
                    </div>
                  )}

                  {harnessNotice && (
                    <div className="text-[10px] text-done">{harnessNotice}</div>
                  )}
                </div>

                {/* All Built-in (20) & Custom Harnesses */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold tracking-wider text-fg-3 uppercase">
                    Catalog ({harnesses.length} harnesses · {harnesses.filter((h) => h.installed).length} installed)
                  </div>
                  {harnesses.map((h) => (
                    <div
                      key={h.id}
                      className={`flex items-center justify-between rounded border border-line bg-sunken px-2.5 py-1.5 ${
                        !h.enabled ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <HarnessGlyph harness={h} size={20} />
                        <span className="truncate text-[11px] font-medium text-fg">{h.name}</span>
                        <span className="truncate font-mono text-[10px] text-fg-3">
                          {h.command}
                          {h.defaultArgs.length > 0 ? ` ${h.defaultArgs.join(' ')}` : ''}
                        </span>
                        {h.installed && (
                          <span className="rounded bg-done/15 px-1 py-0.5 text-[9px] text-done">
                            installed
                          </span>
                        )}
                        {!h.isBuiltin && (
                          <span className="rounded bg-cobalt/15 px-1 py-0.5 text-[9px] text-cobalt">
                            custom
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="Edit command / default args / logo"
                          onClick={() => handleEditHarness(h)}
                          className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleHarnessEnabled(h)}
                          className="rounded border border-line px-1.5 py-0.5 text-[9px] text-fg-2 hover:text-fg cursor-pointer"
                        >
                          {h.enabled ? 'On' : 'Off'}
                        </button>
                        {!h.isBuiltin && (
                          <button
                            type="button"
                            title="Delete custom harness"
                            onClick={() => void handleDeleteHarness(h.id)}
                            className="rounded p-1 text-fg-3 hover:text-fail cursor-pointer"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
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
