import { Terminal } from 'lucide-react'
import aiderLogo from '../../assets/logos/aider.png'
import amazonqLogo from '../../assets/logos/amazonq.svg'
import ampLogo from '../../assets/logos/amp.svg'
import antigravityLogo from '../../assets/logos/antigravity.svg'
import claudeLogo from '../../assets/logos/claude.svg'
import clineLogo from '../../assets/logos/cline.svg'
import codexLogo from '../../assets/logos/codex.svg'
import copilotLogo from '../../assets/logos/copilot.svg'
import cursorLogo from '../../assets/logos/cursor.svg'
import droidLogo from '../../assets/logos/droid.svg'
import geminiLogo from '../../assets/logos/gemini.svg'
import gooseLogo from '../../assets/logos/goose.svg'
import grokLogo from '../../assets/logos/grok.svg'
import kiloLogo from '../../assets/logos/kilo.svg'
import kimiLogo from '../../assets/logos/kimi.svg'
import kiroLogo from '../../assets/logos/kiro.svg'
import opencodeLogo from '../../assets/logos/opencode.svg'
import qwenLogo from '../../assets/logos/qwen.svg'
import roocodeLogo from '../../assets/logos/roocode.svg'
import traeLogo from '../../assets/logos/trae.svg'
import vibeLogo from '../../assets/logos/vibe.svg'
import windsurfLogo from '../../assets/logos/windsurf.svg'

export const OFFICIAL_LOGOS: Record<string, string> = {
  claude: claudeLogo,
  codex: codexLogo,
  opencode: opencodeLogo,
  gemini: geminiLogo,
  cursor: cursorLogo,
  copilot: copilotLogo,
  antigravity: antigravityLogo,
  aider: aiderLogo,
  cline: clineLogo,
  qwen: qwenLogo,
  goose: gooseLogo,
  kilo: kiloLogo,
  roocode: roocodeLogo,
  amp: ampLogo,
  kimi: kimiLogo,
  kiro: kiroLogo,
  grok: grokLogo,
  vibe: vibeLogo,
  droid: droidLogo,
  amazonq: amazonqLogo,
  trae: traeLogo,
  windsurf: windsurfLogo,
}

export const LOGO_PRESET_IDS = Object.keys(OFFICIAL_LOGOS)

interface HarnessLogoProps {
  id?: string
  iconId?: string | null
  accentColor?: string
  size?: number
}

/**
 * Bundled official brand logos (vendored locally for 100% offline / zero-telemetry rendering),
 * plus custom preset / data-URI support for user-defined CLI harnesses.
 */
export function HarnessLogo({
  id,
  iconId,
  accentColor = '#64748B',
  size = 18,
}: HarnessLogoProps) {
  const customSrc =
    iconId && (iconId.startsWith('data:image/') || iconId.startsWith('https://'))
      ? iconId
      : iconId
        ? OFFICIAL_LOGOS[iconId]
        : undefined
  const src = customSrc ?? (id ? OFFICIAL_LOGOS[id] : undefined)

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-[2px] object-contain select-none"
      />
    )
  }

  return <Terminal style={{ width: size, height: size, color: accentColor }} />
}
