import { Terminal } from 'lucide-react'
import ampLogo from '../../assets/logos/amp.svg'
import antigravityLogo from '../../assets/logos/antigravity.svg'
import claudeLogo from '../../assets/logos/claude.svg'
import codexLogo from '../../assets/logos/codex.svg'
import copilotLogo from '../../assets/logos/copilot.svg'
import droidLogo from '../../assets/logos/droid.svg'
import geminiLogo from '../../assets/logos/gemini.svg'
import grokLogo from '../../assets/logos/grok.svg'
import kimiLogo from '../../assets/logos/kimi.svg'
import kiroLogo from '../../assets/logos/kiro.svg'
import opencodeLogo from '../../assets/logos/opencode.svg'
import vibeLogo from '../../assets/logos/vibe.svg'

const OFFICIAL_LOGOS: Record<string, string> = {
  claude: claudeLogo,
  codex: codexLogo,
  opencode: opencodeLogo,
  gemini: geminiLogo,
  copilot: copilotLogo,
  antigravity: antigravityLogo,
  amp: ampLogo,
  kimi: kimiLogo,
  kiro: kiroLogo,
  grok: grokLogo,
  vibe: vibeLogo,
  droid: droidLogo,
}

interface HarnessLogoProps {
  id?: string
  accentColor?: string
  size?: number
}

/**
 * Bundled official vector logos (from @lobehub/icons-static-svg + official brand assets,
 * vendored locally for 100% offline / zero-telemetry rendering) with a terminal icon fallback
 * for custom user-defined CLIs.
 */
export function HarnessLogo({ id, accentColor = '#64748B', size = 18 }: HarnessLogoProps) {
  const src = id ? OFFICIAL_LOGOS[id] : undefined
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain select-none"
      />
    )
  }

  return <Terminal style={{ width: size, height: size, color: accentColor }} />
}
