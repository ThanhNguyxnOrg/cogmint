import type { SplitNode } from '../types/workspace'
import { closePaneFromTree, reorderTabInLeaf, splitLeaf } from './splitTree'

test('splitLeaf splits target leaf and closePaneFromTree collapses sibling cleanly', () => {
  const root: SplitNode = { type: 'leaf', id: 'l1', paneIds: ['p1'], activePaneId: 'p1' }
  const split = splitLeaf(root, 'l1', 'vertical', 'p2')
  expect(split.type).toBe('split')
  const collapsed = closePaneFromTree(split, 'p2')
  expect(collapsed).toEqual({ type: 'leaf', id: 'l1', paneIds: ['p1'], activePaneId: 'p1' })
})

test('reorderTabInLeaf keeps pinned tabs ahead of unpinned tabs', () => {
  const root: SplitNode = { type: 'leaf', id: 'l1', paneIds: ['p1', 'p2', 'p3'], activePaneId: 'p1' }
  const reordered = reorderTabInLeaf(root, 'l1', 2, 0, new Set(['p1']))
  expect(reordered.type).toBe('leaf')
  if (reordered.type === 'leaf') {
    expect(reordered.paneIds).toEqual(['p1', 'p3', 'p2'])
  }
})
