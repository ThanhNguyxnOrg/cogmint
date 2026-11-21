import { create } from 'zustand'
import type { EditorPreset, ShellProfile } from '../types/ipc'

export interface BudgetSettings {
  dailyUsdCap: number
  monthlyUsdCap: number
}

interface SettingsState {
  availableShells: ShellProfile[]
  wslDistros: string[]
  defaultShellId: string | null
  editorPreset: EditorPreset
  budgets: BudgetSettings
  pricingUrl: string

  setAvailableShells: (shells: ShellProfile[]) => void
  setWslDistros: (distros: string[]) => void
  setDefaultShellId: (id: string | null) => void
  setEditorPreset: (preset: EditorPreset) => void
  setBudgets: (budgets: BudgetSettings) => void
  setPricingUrl: (url: string) => void
}

const DEFAULT_PRICING_URL =
  'https://raw.githubusercontent.com/ThanhNguyxnOrg/cogmint/main/src-tauri/resources/pricing.json'

export const useSettingsStore = create<SettingsState>((set) => ({
  availableShells: [],
  wslDistros: [],
  defaultShellId: null,
  editorPreset: { kind: 'vsCode' },
  budgets: { dailyUsdCap: 15, monthlyUsdCap: 300 },
  pricingUrl: DEFAULT_PRICING_URL,

  setAvailableShells: (availableShells) =>
    set((s) => ({
      availableShells,
      defaultShellId: s.defaultShellId ?? availableShells[0]?.id ?? null,
    })),
  setWslDistros: (wslDistros) => set({ wslDistros }),
  setDefaultShellId: (defaultShellId) => set({ defaultShellId }),
  setEditorPreset: (editorPreset) => set({ editorPreset }),
  setBudgets: (budgets) => set({ budgets }),
  setPricingUrl: (pricingUrl) => set({ pricingUrl }),
}))
