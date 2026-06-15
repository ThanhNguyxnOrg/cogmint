import { exec } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export default defineEventHandler(async (event) => {
  const platform = process.platform

  return new Promise<{ path: string | null }>((resolve, reject) => {
    let cmd = ''

    if (platform === 'win32') {
      // Create a temporary PowerShell script to display the folder dialog in STA mode
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Select project directory for COGMINT"
$f.ShowNewFolderButton = $true
$result = $f.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $f.SelectedPath
}
`
      const tempFile = join(tmpdir(), `cogmint-dir-${Date.now()}.ps1`)
      try {
        writeFileSync(tempFile, psScript, 'utf8')
      } catch (err: any) {
        return reject(createError({ statusCode: 500, message: `Failed to create temp script: ${err.message}` }))
      }

      cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`

      exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
        // Clean up temporary script file
        try {
          unlinkSync(tempFile)
        } catch {}

        if (error && error.code !== 0) {
          // If cancelled, PowerShell might exit with an error code depending on environment
          console.warn('[Dialog] PowerShell exited with code:', error.code, stderr)
          return resolve({ path: null })
        }

        const path = stdout.trim()
        resolve({ path: path || null })
      })

    } else if (platform === 'darwin') {
      cmd = `osascript -e "POSIX path of (choose folder with prompt \\"Select project directory for COGMINT\\")"`
      exec(cmd, (error, stdout) => {
        if (error) {
          // Typically user cancelled
          return resolve({ path: null })
        }
        resolve({ path: stdout.trim() || null })
      })

    } else {
      // Linux fallback to Zenity
      cmd = 'zenity --file-selection --directory --title="Select project directory for COGMINT"'
      exec(cmd, (error, stdout) => {
        if (error) {
          // Typically cancelled or zenity not installed
          return resolve({ path: null })
        }
        resolve({ path: stdout.trim() || null })
      })
    }
  })
})
