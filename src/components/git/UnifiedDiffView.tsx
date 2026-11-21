import { ExternalLink } from 'lucide-react'
import type { FileDiffResult } from '../../types/ipc'
import { Btn } from '../ui/Primitives'

interface UnifiedDiffViewProps {
  diff: FileDiffResult | null
  loading: boolean
  onOpenExternal: () => void
}

export function UnifiedDiffView({ diff, loading, onOpenExternal }: UnifiedDiffViewProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-sunken text-[11px] text-fg-3">
        Loading diff...
      </div>
    )
  }

  if (!diff) {
    return (
      <div className="flex h-full items-center justify-center bg-sunken p-4 text-center text-[11px] text-fg-3">
        Select a modified file above to inspect its read-only unified diff.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-sunken">
      <div className="flex h-8 shrink-0 items-center justify-between border-y border-line bg-rail px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-[10px] text-fg-2">{diff.path}</span>
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-fg-3">
            Read-only
          </span>
        </div>
        <Btn variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={onOpenExternal}>
          <ExternalLink className="size-3" />
          Open
        </Btn>
      </div>

      {diff.isBinary ? (
        <div className="p-4 text-center text-[11px] text-fg-3">
          Binary file diff cannot be displayed. Use Open to inspect externally.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px] leading-relaxed selectable">
          {diff.truncated && (
            <div className="mb-2 rounded border border-attn/30 bg-attn/10 px-2 py-1 text-[10px] text-attn">
              Diff truncated at 256 KB. Open in external editor to view full file.
            </div>
          )}
          {diff.unifiedDiff.split('\n').map((line, idx) => {
            let cls = 'text-fg-2'
            if (line.startsWith('+') && !line.startsWith('+++')) {
              cls = 'bg-done/10 text-done'
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              cls = 'bg-fail/10 text-fail'
            } else if (line.startsWith('@@')) {
              cls = 'bg-cobalt/10 text-cobalt'
            }
            return (
              <div key={idx} className={`whitespace-pre px-1.5 ${cls}`}>
                {line || ' '}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
