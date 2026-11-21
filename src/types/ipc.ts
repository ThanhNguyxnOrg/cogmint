export type AttentionState =
  | 'working'
  | 'needs_attention'
  | 'idle'
  | 'done'
  | 'failed'
  | 'hibernated'

export type PtyStreamEvent =
  | { event: 'output'; data: { data: string } }
  | { event: 'exit'; data: { exitCode: number | null } }
  | { event: 'attention'; data: { state: AttentionState; latestWords: string | null } }

export interface SpawnPtyRequest {
  paneId: string
  cwd: string
  cols: number
  rows: number
  harnessId?: string | null
  program?: string | null
  args?: string[]
  env?: Record<string, string>
  shellProfile?: string | null
}

export interface ShellProfile {
  id: string
  label: string
  program: string
  args: string[]
  isWsl: boolean
}

export type ResumeStrategy = 'exactFlag' | 'latestFlag' | 'bareRelaunch'

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'unknown'
export type AuthMethod = 'cogmint_profile' | 'env_var' | 'oauth_file' | 'none'

export interface HarnessAuthInfo {
  status: AuthStatus
  method: AuthMethod
  detail: string | null
  loginCommand: string[]
  apiKeyEnv: string | null
  baseUrlEnv: string | null
  supportsOauth: boolean
  authNotes: string
}

export interface HarnessAuthProfileSummary {
  harnessId: string
  hasApiKey: boolean
  apiKeyPreview: string | null
  baseUrl: string | null
  extraEnv: Record<string, string>
  useCustomEnv: boolean
}

export interface SaveHarnessAuthProfileRequest {
  harnessId: string
  apiKey?: string | null
  clearApiKey?: boolean
  baseUrl?: string | null
  extraEnv: Record<string, string>
  useCustomEnv: boolean
}

export interface HarnessSpec {
  id: string
  name: string
  mono: string
  command: string
  defaultArgs: string[]
  resumeStrategy: ResumeStrategy
  accentColor: string
  isBuiltin: boolean
  enabled: boolean
  installed: boolean
  resolvedPath: string | null
  iconId?: string | null
  auth?: HarnessAuthInfo
}

export interface CustomHarnessRecord {
  id: string
  name: string
  command: string
  defaultArgs: string[]
  accentColor: string
  enabled: boolean
  iconId?: string | null
}

export type EditorPreset =
  | { kind: 'vsCode' }
  | { kind: 'cursor' }
  | { kind: 'zed' }
  | { kind: 'custom'; template: string }

export interface FileChangeEntry {
  path: string
  status: string
  staged: boolean
  untracked: boolean
}

export interface GitStatusSummary {
  isGitRepo: boolean
  branch: string | null
  ahead: number
  behind: number
  changes: FileChangeEntry[]
}

export interface FileDiffResult {
  path: string
  isBinary: boolean
  truncated: boolean
  unifiedDiff: string
}

export interface MergePreview {
  baseBranch: string
  ahead: number
  behind: number
  hasConflicts: boolean
  conflictingFiles: string[]
}

export interface WorktreeInfo {
  path: string
  branch: string | null
  headSha: string | null
  isMain: boolean
  isPrunable: boolean
}

export interface WorktreeRecoveryReport {
  branchExists: boolean
  dirExists: boolean
  registered: boolean
  message: string
}

export interface CreateWorktreeRequest {
  repoRoot: string
  branch: string
  baseRef?: string | null
  targetDir?: string | null
}
