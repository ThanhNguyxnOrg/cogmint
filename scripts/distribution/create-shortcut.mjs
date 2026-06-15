import { execSync } from 'node:child_process'
import { homedir, platform } from 'node:os'
import { join, resolve } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..', '..')
const vbsPath = join(root, 'bin', 'launch-silently.vbs')
const iconPath = join(root, 'public', 'favicon.ico')

function main() {
  console.log('Building COGMINT for production (this makes pages load instantly)...')
  try {
    execSync('npm run build', { cwd: root, stdio: 'inherit' })
  } catch (error) {
    console.error('Build failed. The shortcut will still be created, but you might need to build manually later.')
  }

  const os = platform()
  if (os === 'win32') {
    console.log('Creating Windows Desktop shortcut...')
    const desktopDir = join(homedir(), 'Desktop')
    const shortcutPath = join(desktopDir, 'COGMINT.lnk')

    // Prepare PowerShell script to create the Windows shortcut
    // target path points to wscript.exe, and arguments pass the path to the silent vbs launcher
    const psScript = `
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
$s.TargetPath = "wscript.exe"
$s.Arguments = """${vbsPath.replace(/\\/g, '\\\\')}"""
$s.WorkingDirectory = "${root.replace(/\\/g, '\\\\')}"
if (Test-Path "${iconPath.replace(/\\/g, '\\\\')}") {
    $s.IconLocation = "${iconPath.replace(/\\/g, '\\\\')}"
}
$s.Description = "Launch COGMINT visual control plane"
$s.Save()
`
    const tempPsFile = join(root, 'bin', 'create-lnk.ps1')
    writeFileSync(tempPsFile, psScript, 'utf8')

    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPsFile}"`, { stdio: 'inherit' })
      console.log(`\n🎉 Success! COGMINT Desktop shortcut created at: ${shortcutPath}`)
      console.log('You can now double-click it to run COGMINT silently in the background!')
    } catch (err) {
      console.error('Failed to create Desktop shortcut via PowerShell:', err.message)
    } finally {
      // Clean up temporary script
      try {
        execSync(`powershell -NoProfile -Command "Remove-Item -Force '${tempPsFile.replace(/\\/g, '\\\\')}'"`)
      } catch {}
    }
  } else if (os === 'darwin') {
    console.log('macOS detected: You can launch COGMINT by running: npm run preview')
    console.log('Or configure an Automator app wrapping the startup command.')
  } else {
    console.log('Linux detected: You can launch COGMINT by running: npm run preview')
  }
}

main()
