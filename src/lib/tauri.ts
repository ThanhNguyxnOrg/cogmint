import { Channel, invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import type {
  CreateWorktreeRequest,
  CustomHarnessRecord,
  EditorPreset,
  FileDiffResult,
  GitStatusSummary,
  HarnessSpec,
  MergePreview,
  PtyStreamEvent,
  ShellProfile,
  SpawnPtyRequest,
} from '../types/ipc'
import type {
  CreateWorktreeResponse,
  PaneJournalRecord,
  ProjectRecord,
  WorkspaceJournalSnapshot,
  WorkspaceRecord,
} from '../types/workspace'
import type { ModelPrice, UsageSummary } from '../types/usage'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function spawnPanePty(
  request: SpawnPtyRequest,
  onMessage: (event: PtyStreamEvent) => void,
): Promise<void> {
  if (!isTauriRuntime()) return
  const onEvent = new Channel<PtyStreamEvent>()
  onEvent.onmessage = onMessage
  await invoke('spawn_pane_pty', { request, onEvent })
}

export async function writePty(paneId: string, data: string): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('write_pty', { paneId, data })
}

export async function resizePty(paneId: string, cols: number, rows: number): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('resize_pty', { paneId, cols, rows })
}

export async function killPty(paneId: string): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('kill_pty', { paneId })
}

export async function detectShells(): Promise<ShellProfile[]> {
  if (!isTauriRuntime()) return []
  return invoke<ShellProfile[]>('detect_shells')
}

export async function listWslDistros(): Promise<string[]> {
  if (!isTauriRuntime()) return []
  return invoke<string[]>('list_wsl_distros')
}

export async function listHarnesses(): Promise<HarnessSpec[]> {
  if (!isTauriRuntime()) return []
  return invoke<HarnessSpec[]>('list_harnesses')
}

export async function upsertCustomHarness(record: CustomHarnessRecord): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('upsert_custom_harness', { record })
}

export async function deleteCustomHarness(id: string): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('delete_custom_harness', { id })
}

export async function resolveResumeSession(
  harnessId: string,
  cwd: string,
): Promise<string | null> {
  if (!isTauriRuntime()) return null
  return invoke<string | null>('resolve_resume_session', { harnessId, cwd })
}

export async function registerProject(
  rootPath: string,
): Promise<[ProjectRecord, WorkspaceRecord[]]> {
  return invoke<[ProjectRecord, WorkspaceRecord[]]>('register_project', { rootPath })
}

export async function pickDirectoryDialog(): Promise<string | null> {
  if (!isTauriRuntime()) return null
  const picked = await openDialog({ directory: true, multiple: false })
  return typeof picked === 'string' ? picked : null
}

export async function createWorktree(
  projectId: string,
  request: CreateWorktreeRequest,
): Promise<CreateWorktreeResponse> {
  return invoke<CreateWorktreeResponse>('create_worktree', { projectId, request })
}

export async function removeWorktree(
  workspaceId: string,
  repoRoot: string,
  worktreePath: string,
  force = false,
): Promise<void> {
  await invoke('remove_worktree', { workspaceId, repoRoot, worktreePath, force })
}

export async function watchWorkspace(workspaceId: string, path: string): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('watch_workspace', { workspaceId, path })
}

export async function onWorkspaceDirty(
  cb: (workspaceId: string) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return () => {}
  return listen<string>('workspace:dirty', (event) => cb(event.payload))
}

export async function saveWorkspaceLayout(
  workspaceId: string,
  treeJson: string,
  panes: PaneJournalRecord[],
): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('save_workspace_layout', { workspaceId, treeJson, panes })
}

export async function loadWorkspaceJournal(): Promise<WorkspaceJournalSnapshot | null> {
  if (!isTauriRuntime()) return null
  return invoke<WorkspaceJournalSnapshot>('load_workspace_journal')
}

export async function markBootClean(): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('mark_boot_clean')
}

export async function getGitStatus(dir: string): Promise<GitStatusSummary> {
  if (!isTauriRuntime()) {
    return { isGitRepo: false, branch: null, ahead: 0, behind: 0, changes: [] }
  }
  return invoke<GitStatusSummary>('get_git_status', { dir })
}

export async function getFileDiff(
  dir: string,
  relPath: string,
  staged: boolean,
): Promise<FileDiffResult> {
  return invoke<FileDiffResult>('get_file_diff', { dir, relPath, staged })
}

export async function stageFiles(dir: string, paths: string[]): Promise<void> {
  await invoke('stage_files', { dir, paths })
}

export async function unstageFiles(dir: string, paths: string[]): Promise<void> {
  await invoke('unstage_files', { dir, paths })
}

export async function commitChanges(dir: string, message: string): Promise<string> {
  return invoke<string>('commit_changes', { dir, message })
}

export async function getMergePreview(dir: string, baseBranch: string): Promise<MergePreview> {
  return invoke<MergePreview>('get_merge_preview', { dir, baseBranch })
}

export async function openInEditor(
  preset: EditorPreset,
  path: string,
  line?: number,
  col?: number,
): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('open_in_editor', { preset, path, line: line ?? null, col: col ?? null })
}

export async function getUsageSummary(days = 30): Promise<UsageSummary> {
  if (!isTauriRuntime()) {
    return {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      byHarness: [],
      byModel: [],
      byDay: [],
      pricingUpdatedAt: new Date().toISOString(),
    }
  }
  return invoke<UsageSummary>('get_usage_summary', { days })
}

export async function listPricing(): Promise<ModelPrice[]> {
  if (!isTauriRuntime()) return []
  return invoke<ModelPrice[]>('list_pricing')
}

export async function refreshPricing(url: string): Promise<string> {
  return invoke<string>('refresh_pricing', { url })
}

export async function setPricingOverride(record: ModelPrice): Promise<void> {
  await invoke('set_pricing_override', { record })
}

export async function notifyNative(title: string, body: string): Promise<void> {
  if (!isTauriRuntime()) return
  let granted = await isPermissionGranted()
  if (!granted) {
    const res = await requestPermission()
    granted = res === 'granted'
  }
  if (granted) {
    sendNotification({ title, body })
  }
}
