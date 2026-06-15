Set WshShell = CreateObject("WScript.Shell")
currentDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptPosition)
' Launch start.mjs silently in background with the --open flag
WshShell.Run "node """ & currentDir & "\start.mjs"" --open", 0, False
