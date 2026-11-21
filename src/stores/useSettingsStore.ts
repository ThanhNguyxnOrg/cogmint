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
  leftRailWidth: number
  rightDrawerWidth: number

  setAvailableShells: (shells: ShellProfile[]) => void
  setWslDistros: (distros: string[]) => void
  setDefaultShellId: (id: string | null) => void
  setEditorPreset: (preset: EditorPreset) => void
  setBudgets: (budgets: BudgetSettings) => void
  setPricingUrl: (url: string) => void
  setLeftRailWidth: (width: number) => void
  setRightDrawerWidth: (width: number) => void
}

const DEFAULT_PRICING_URL =
  'https://raw.githubusercontent.com/ThanhNguyxnOrg/cogmint/main/src-tauri/resources/pricing.json'

function readStoredNumber(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, Math.round(parsed)))
  } catch {
    return fallback
  }
}

function writeStoredNumber(key: string, value: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, String(Math.round(value)))
  } catch {
    // ignore storage errors
  }
}

export const DEFAULT_LEFT_RAIL_WIDTH = 260
export const DEFAULT_RIGHT_DRAWER_WIDTH = 340

export const useSettingsStore = create<SettingsState>((set) => ({
  availableShells: [],
  wslDistros: [],
  defaultShellId: null,
  editorPreset: { kind: 'vsCode' },
  budgets: { dailyUsdCap: 15, monthlyUsdCap: 300 },
  pricingUrl: DEFAULT_PRICING_URL,
  leftRailWidth: readStoredNumber('cogmint:leftRailWidth', DEFAULT_LEFT_RAIL_WIDTH, 180, 480),
  rightDrawerWidth: readStoredNumber(
    'cogmint:rightDrawerWidth',
    DEFAULT_RIGHT_DRAWER_WIDTH,
    240,
    680,
  ),

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
  setLeftRailWidth: (width) => {
    const clamped = Math.min(480, Math.max(180, Math.round(width)))
    writeStoredNumber('cogmint:leftRailWidth', clamped)
    set({ leftRailWidth: clamped })
  },
  setRightDrawerWidth: (width) => {
    const clamped = Math.min(680, Math.max(240, Math.round(width)))
    writeStoredNumber('cogmint:rightDrawerWidth', clamped)
    set({ rightDrawerWidth: clamped })
  },
}))
