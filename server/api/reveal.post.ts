import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { existsSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  const { path } = await readBody<{ path: string }>(event)

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required' })
  }

  // If it's a file, open the containing directory
  const targetPath = existsSync(path) ? dirname(path) : path

  if (!existsSync(targetPath)) {
    throw createError({ statusCode: 404, message: 'Path not found' })
  }

  const platform = process.platform
  let cmd = ''
  let args: string[] = []

  if (platform === 'darwin') {
    cmd = 'open'
    args = [targetPath]
  } else if (platform === 'win32') {
    cmd = 'explorer'
    args = [targetPath]
  } else {
    cmd = 'xdg-open'
    args = [targetPath]
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: 'ignore' })
      child.on('error', (err) => {
        reject(err)
      })
      child.on('close', (code) => {
        if (code === 0 || platform === 'win32') {
          resolve()
        } else {
          reject(new Error(`Process exited with code ${code}`))
        }
      })
    })
    return { success: true }
  } catch (err: any) {
    // Windows explorer.exe frequently returns a non-zero exit code (e.g., 1)
    // even when it successfully launches the window. Since we already verified
    // that targetPath exists, we can safely treat this as a success on Windows.
    if (platform === 'win32') {
      return { success: true }
    }
    throw createError({ statusCode: 500, message: `Failed to open directory: ${err.message}` })
  }
})
