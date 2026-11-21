import { useState } from 'react'
import { Search } from 'lucide-react'
import { Kbd } from '../ui/Primitives'

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  shortcut?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  commands: PaletteCommand[]
  onClose: () => void
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)

  if (!open) return null

  const filtered = commands.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      (c.hint ?? '').toLowerCase().includes(query.toLowerCase()),
  )
  const clampedIdx = Math.min(idx, Math.max(0, filtered.length - 1))

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[14vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg animate-modal-in overflow-hidden rounded-lg border border-line-strong bg-raised shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Search className="size-4 text-fg-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIdx(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((v) => Math.min(v + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((v) => Math.max(v - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const cmd = filtered[clampedIdx]
                if (cmd) {
                  cmd.run()
                  onClose()
                }
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="Jump to attention pane, switch worktree, launch harness..."
            className="flex-1 bg-transparent text-[12px] text-fg placeholder:text-fg-3 focus:outline-none"
          />
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-fg-3">No matching commands</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => {
                  cmd.run()
                  onClose()
                }}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] cursor-pointer ${
                  i === clampedIdx ? 'bg-cobalt/15 text-fg' : 'text-fg-2 hover:bg-white/[0.04]'
                }`}
              >
                <div>
                  <div className="font-medium">{cmd.label}</div>
                  {cmd.hint && <div className="font-mono text-[10px] text-fg-3">{cmd.hint}</div>}
                </div>
                {cmd.shortcut && <Kbd keys={cmd.shortcut} />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
