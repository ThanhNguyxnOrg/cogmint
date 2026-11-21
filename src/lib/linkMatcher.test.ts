import { findFileLinks } from './linkMatcher'

test('test_link_matcher_windows_paths_with_spaces', () => {
  const links = findFileLinks('Error at "C:\\Users\\My Name\\repo\\src\\app.tsx:42:10" failed')
  expect(links).toHaveLength(1)
  expect(links[0]).toMatchObject({
    path: 'C:\\Users\\My Name\\repo\\src\\app.tsx',
    line: 42,
    col: 10,
  })
})

test('parses POSIX absolute and relative file:line links', () => {
  const links = findFileLinks('See ./src/lib/splitTree.ts:88 and /home/dev/main.rs:12:3')
  expect(links).toHaveLength(2)
  expect(links[0]).toMatchObject({ path: './src/lib/splitTree.ts', line: 88, col: undefined })
  expect(links[1]).toMatchObject({ path: '/home/dev/main.rs', line: 12, col: 3 })
})
