import { useState } from 'react'
import { ArrowLeft, DollarSign, RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { UsageSummary } from '../../types/usage'
import { refreshPricing } from '../../lib/tauri'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Btn } from '../ui/Primitives'
import { PricingSettingsModal } from './PricingSettingsModal'

interface UsageDashboardProps {
  summary: UsageSummary | null
  onReload: () => void
  onBack: () => void
}

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

export function UsageDashboard({ summary, onReload, onBack }: UsageDashboardProps) {
  const budgets = useSettingsStore((s) => s.budgets)
  const pricingUrl = useSettingsStore((s) => s.pricingUrl)
  const [refreshing, setRefreshing] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)

  const handleRefreshPricing = async () => {
    setRefreshing(true)
    try {
      await refreshPricing(pricingUrl)
      onReload()
    } catch {
      // Offline fallback remains active
    } finally {
      setRefreshing(false)
    }
  }

  const isEmpty = !summary || (summary.totalCostUsd === 0 && summary.byDay.length === 0)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCost = summary?.byDay.find((d) => d.date === todayStr)?.costUsd ?? 0
  const budgetPct =
    budgets.dailyUsdCap > 0 ? Math.min(100, (todayCost / budgets.dailyUsdCap) * 100) : 0

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-canvas p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Btn variant="ghost" onClick={onBack}>
              <ArrowLeft className="size-3.5" />
              Back to Stage
            </Btn>
            <div>
              <h1 className="text-[15px] font-semibold text-fg">Local Usage & Cost Accounting</h1>
              <p className="font-mono text-[10px] text-fg-3">
                100% local session logs · Pricing updated: {summary?.pricingUpdatedAt ?? 'bundled'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Btn variant="secondary" disabled={refreshing} onClick={() => void handleRefreshPricing()}>
              <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Pricing
            </Btn>
            <Btn variant="secondary" onClick={() => setPricingOpen(true)}>
              <SlidersHorizontal className="size-3" />
              Pricing & Overrides
            </Btn>
          </div>
        </div>

        {isEmpty ? (
          <div className="rounded-lg border border-dashed border-line-strong bg-raised/60 p-10 text-center">
            <DollarSign className="mx-auto size-8 text-fg-3" />
            <h2 className="mt-3 text-[13px] font-semibold text-fg">No local usage recorded yet</h2>
            <p className="mx-auto mt-1.5 max-w-md text-[11px] text-fg-2">
              Run a Claude Code, Codex, or OpenCode session to start tracking real token consumption
              and model costs. COGMINT never displays synthetic or mock usage figures.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border border-line bg-raised p-4">
                <div className="text-[10px] tracking-wider text-fg-3 uppercase">30D Total Spend</div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-fg">
                  ${summary.totalCostUsd.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-raised p-4">
                <div className="text-[10px] tracking-wider text-fg-3 uppercase">Input Tokens</div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-fg">
                  {fmtTok(summary.totalInputTokens)}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-raised p-4">
                <div className="text-[10px] tracking-wider text-fg-3 uppercase">Output Tokens</div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-fg">
                  {fmtTok(summary.totalOutputTokens)}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-raised p-4">
                <div className="text-[10px] tracking-wider text-fg-3 uppercase">Cache Read</div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-fg">
                  {fmtTok(summary.totalCacheReadTokens)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-raised p-4">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-fg">Daily Budget Pace</span>
                <span className="font-mono tabular-nums text-fg-2">
                  ${todayCost.toFixed(2)} / ${budgets.dailyUsdCap.toFixed(2)} ({budgetPct.toFixed(0)}%)
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
                <div
                  className={`h-full rounded-full ${
                    budgetPct >= 90 ? 'bg-fail' : budgetPct >= 75 ? 'bg-attn' : 'bg-cobalt'
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-line bg-raised p-4">
                <h3 className="text-[12px] font-semibold text-fg">By Harness</h3>
                <div className="mt-3 space-y-2">
                  {summary.byHarness.map((h) => (
                    <div
                      key={h.harnessId}
                      className="flex items-center justify-between border-b border-line pb-1.5 font-mono text-[11px]"
                    >
                      <span className="text-fg">{h.harnessId}</span>
                      <span className="tabular-nums text-fg-2">
                        {fmtTok(h.inputTokens + h.outputTokens)} tok · ${h.costUsd.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-line bg-raised p-4">
                <h3 className="text-[12px] font-semibold text-fg">By Model</h3>
                <div className="mt-3 space-y-2">
                  {summary.byModel.map((m) => (
                    <div
                      key={m.modelId}
                      className="flex items-center justify-between border-b border-line pb-1.5 font-mono text-[11px]"
                    >
                      <span className="truncate text-fg">{m.modelId}</span>
                      <span className="tabular-nums text-fg-2">${m.costUsd.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <PricingSettingsModal
        open={pricingOpen}
        onClose={() => {
          setPricingOpen(false)
          onReload()
        }}
      />
    </div>
  )
}
