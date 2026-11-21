export interface MatchedFileLink {
  raw: string
  path: string
  line?: number
  col?: number
  startIndex: number
  endIndex: number
}

// Matches:
// 1. Quoted Windows or POSIX paths with spaces: "C:\Users\My Name\file.ts:42:10"
// 2. Unquoted Windows paths (backslash or forward slash): C:\foo\bar.rs:12:3 or C:/foo/bar.ts:12
// 3. Unquoted POSIX/Windows relative or absolute paths: ./src/a.ts:88, .\src\a.ts:88, /home/dev/main.rs:12:3
const FILE_LINK_REGEX =
  /"((?:[A-Za-z]:[\\/]|\/|\.\.?[\\/])[^"\r\n]+?\.[A-Za-z0-9]{1,10})(?::(\d+))?(?::(\d+))?"|((?:[A-Za-z]:[\\/]|\/|\.\.?[\\/])[^\s"'`<>|)\]]+?\.[A-Za-z0-9]{1,10})(?::(\d+))?(?::(\d+))?/g

export function findFileLinks(lineText: string): MatchedFileLink[] {
  const results: MatchedFileLink[] = []
  FILE_LINK_REGEX.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = FILE_LINK_REGEX.exec(lineText)) !== null) {
    const isQuoted = match[1] !== undefined
    const path = isQuoted ? match[1] : match[4]
    const lineRaw = isQuoted ? match[2] : match[5]
    const colRaw = isQuoted ? match[3] : match[6]

    if (!path) continue
    // Skip URLs like http://example.com/a.js
    const prefixStart = Math.max(0, match.index - 8)
    const before = lineText.slice(prefixStart, match.index)
    if (before.endsWith('://') || before.endsWith('http:') || before.endsWith('https:')) {
      continue
    }

    const raw = match[0]
    results.push({
      raw,
      path,
      line: lineRaw ? Number.parseInt(lineRaw, 10) : undefined,
      col: colRaw ? Number.parseInt(colRaw, 10) : undefined,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    })
  }

  return results
}
