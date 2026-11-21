import { Terminal } from 'lucide-react'

interface HarnessLogoProps {
  id?: string
  accentColor?: string
  size?: number
}

/**
 * Crisp inline vector brand marks for all 12 built-in coding CLI harnesses,
 * with a clean terminal icon fallback for custom user-defined CLIs.
 */
export function HarnessLogo({ id, accentColor = '#64748B', size = 18 }: HarnessLogoProps) {
  switch (id) {
    case 'claude':
      // Anthropic / Claude 12-ray starburst mark
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <g stroke="#D97757" strokeWidth="2.1" strokeLinecap="round">
            <line x1="12" y1="2.5" x2="12" y2="8.2" />
            <line x1="12" y1="15.8" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="8.2" y2="12" />
            <line x1="15.8" y1="12" x2="21.5" y2="12" />
            <line x1="5.3" y1="5.3" x2="9.3" y2="9.3" />
            <line x1="14.7" y1="14.7" x2="18.7" y2="18.7" />
            <line x1="18.7" y1="5.3" x2="14.7" y2="9.3" />
            <line x1="9.3" y1="14.7" x2="5.3" y2="18.7" />
          </g>
          <circle cx="12" cy="12" r="2.2" fill="#D97757" />
        </svg>
      )

    case 'codex':
      // OpenAI hexagonal blossom / knot mark
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <g stroke="#10A37F" strokeWidth="1.75" strokeLinejoin="round">
            <polygon points="12,3 19.5,7.3 19.5,16.7 12,21 4.5,16.7 4.5,7.3" />
            <path d="M12 3v9m7.5-4.7L12 12m7.5 4.7L12 12m0 9v-9M4.5 16.7L12 12M4.5 7.3L12 12" />
          </g>
          <circle cx="12" cy="12" r="2.1" fill="#0B0F17" stroke="#10A37F" strokeWidth="1.6" />
        </svg>
      )

    case 'opencode':
      // OpenCode nested geometric code frame
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3.5" y="4" width="17" height="16" rx="3" stroke="#2F6FFF" strokeWidth="1.9" />
          <path
            d="M8.5 9.5L11.5 12L8.5 14.5M12.5 14.5H16"
            stroke="#F1F5F9"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )

    case 'gemini':
      // Google Gemini 4-point sparkle star
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <defs>
            <linearGradient id="geminiGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="55%" stopColor="#9B72CB" />
              <stop offset="100%" stopColor="#D96570" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.2C13.2 8.2 15.8 10.8 21.8 12C15.8 13.2 13.2 15.8 12 21.8C10.8 15.8 8.2 13.2 2.2 12C8.2 10.8 10.8 8.2 12 2.2Z"
            fill="url(#geminiGrad)"
          />
        </svg>
      )

    case 'copilot':
      // GitHub Copilot visor/goggles mark
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 11.5C4 7.8 7 5.5 12 5.5C17 5.5 20 7.8 20 11.5V14.5C20 16.7 18.2 18.5 16 18.5H8C5.8 18.5 4 16.7 4 14.5V11.5Z"
            stroke="#E2E8F0"
            strokeWidth="1.8"
          />
          <rect x="7" y="10" width="4" height="4.5" rx="1.4" fill="#E2E8F0" />
          <rect x="13" y="10" width="4" height="4.5" rx="1.4" fill="#E2E8F0" />
        </svg>
      )

    case 'antigravity':
      // Antigravity ascending delta + orbital ring
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3.5L19.2 19.5H15.8L12 10.8L8.2 19.5H4.8L12 3.5Z"
            fill="#05DCA3"
          />
          <ellipse
            cx="12"
            cy="14.5"
            rx="8.5"
            ry="2.6"
            transform="rotate(-14 12 14.5)"
            stroke="#2F6FFF"
            strokeWidth="1.6"
          />
        </svg>
      )

    case 'amp':
      // Amp high-voltage bolt
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M13.5 2.5L5.5 13.5H11.5L10.5 21.5L18.5 10.5H12.5L13.5 2.5Z"
            fill="#F97316"
            stroke="#F97316"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      )

    case 'kimi':
      // Moonshot Kimi crescent + spark
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M16.8 15.6A6.8 6.8 0 0 1 8.4 7.2A7.2 7.2 0 1 0 16.8 15.6Z"
            fill="#38BDF8"
          />
          <circle cx="16.5" cy="7.5" r="2" fill="#E0F2FE" />
        </svg>
      )

    case 'kiro':
      // Kiro ghost / spirit mark
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3.5C7.6 3.5 5 6.8 5 11.2V19.5L8.2 17.5L10.8 19.5L13.2 17.5L15.8 19.5L19 17.5V11.2C19 6.8 16.4 3.5 12 3.5Z"
            fill="#A855F7"
          />
          <circle cx="9.6" cy="11" r="1.4" fill="#0B0F17" />
          <circle cx="14.4" cy="11" r="1.4" fill="#0B0F17" />
        </svg>
      )

    case 'grok':
      // xAI Grok orbital slash
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="7.5" stroke="#F8FAFC" strokeWidth="1.9" />
          <line x1="6" y1="18.5" x2="18.5" y2="5.5" stroke="#F8FAFC" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )

    case 'vibe':
      // Mistral pixel-M mark
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="3.5" height="14" fill="#FACC15" />
          <rect x="17.5" y="5" width="3.5" height="14" fill="#EF4444" />
          <rect x="6.5" y="8.5" width="3.5" height="3.5" fill="#FB923C" />
          <rect x="14" y="8.5" width="3.5" height="3.5" fill="#F97316" />
          <rect x="10.25" y="12" width="3.5" height="4" fill="#EA580C" />
        </svg>
      )

    case 'droid':
      // Factory Droid visor mark
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="6.5" width="16" height="11" rx="3.5" stroke="#22D3EE" strokeWidth="1.9" />
          <line x1="12" y1="3" x2="12" y2="6.5" stroke="#22D3EE" strokeWidth="1.9" strokeLinecap="round" />
          <rect x="7.5" y="10.5" width="9" height="3" rx="1.5" fill="#22D3EE" />
        </svg>
      )

    default:
      return <Terminal style={{ width: size, height: size, color: accentColor }} />
  }
}
