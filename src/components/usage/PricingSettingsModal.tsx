import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ModelPrice } from '../../types/usage'
import { listPricing, setPricingOverride } from '../../lib/tauri'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Btn } from '../ui/Primitives'

interface PricingSettingsModalProps {
  open: boolean
  onClose: () => void
}

export function PricingSettingsModal({ open, onClose }: PricingSettingsModalProps) {
  const budgets = useSettingsStore((s) => s.budgets)
  const setBudgets = useSettingsStore((s) => s.setBudgets)
  const [prices, setPrices] = useState<ModelPrice[]>([])
  const [dailyCap, setDailyCap] = useState(String(budgets.dailyUsdCap))
  const [monthlyCap, setMonthlyCap] = useState(String(budgets.monthlyUsdCap))

  useEffect(() => {
    if (!open) return
    void listPricing().then(setPrices)
  }, [open])

  if (!open) return null

  const saveBudgets = () => {
    setBudgets({
      dailyUsdCap: Number.parseFloat(dailyCap) || 15,
      monthlyUsdCap: Number.parseFloat(monthlyCap) || 300,
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
      <div className="w-full max-w-2xl animate-modal-in rounded-lg border border-line-strong bg-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold text-fg">Model Pricing & Budgets</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-fg-3 hover:bg-white/[0.06] hover:text-fg cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[10px] font-medium text-fg-2">Daily Budget Cap (USD)</span>
              <input
                type="number"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-fg"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-medium text-fg-2">Monthly Budget Cap (USD)</span>
              <input
                type="number"
                value={monthlyCap}
                onChange={(e) => setMonthlyCap(e.target.value)}
                className="w-full rounded-md border border-line bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-fg"
              />
            </label>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border border-line bg-sunken">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="border-b border-line bg-rail text-[10px] text-fg-3">
                <tr>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-2 py-2">In / 1M</th>
                  <th className="px-2 py-2">Out / 1M</th>
                  <th className="px-2 py-2">Cache Rd</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.modelId} className="border-b border-line/60">
                    <td className="px-3 py-1.5 text-fg">{p.modelId}</td>
                    <td className="px-2 py-1.5 text-fg-2">${p.inputPerMtok}</td>
                    <td className="px-2 py-1.5 text-fg-2">${p.outputPerMtok}</td>
                    <td className="px-2 py-1.5 text-fg-2">
                      <button
                        type="button"
                        title="Save current rate as override"
                        onClick={() => void setPricingOverride(p)}
                        className="hover:text-cobalt cursor-pointer"
                      >
                        ${p.cacheReadPerMtok}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Btn variant="ghost" onClick={onClose}>
            Close
          </Btn>
          <Btn variant="primary" onClick={saveBudgets}>
            Save Budgets
          </Btn>
        </div>
      </div>
    </div>
  )
}
