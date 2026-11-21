import type { SplitDirection, SplitNode } from '../types/workspace'

let leafSeq = 1
function nextId(prefix: string): string {
  leafSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${leafSeq}`
}

export function createLeaf(paneIds: string[], activePaneId?: string | null): SplitNode {
  return {
    type: 'leaf',
    id: nextId('leaf'),
    paneIds,
    activePaneId: activePaneId ?? paneIds[0] ?? null,
  }
}

export function splitLeaf(
  tree: SplitNode,
  leafId: string,
  direction: SplitDirection,
  newPaneId: string,
): SplitNode {
  if (tree.type === 'leaf') {
    if (tree.id !== leafId) return tree
    return {
      type: 'split',
      id: nextId('split'),
      direction,
      ratio: 0.5,
      first: tree,
      second: {
        type: 'leaf',
        id: nextId('leaf'),
        paneIds: [newPaneId],
        activePaneId: newPaneId,
      },
    }
  }
  return {
    ...tree,
    first: splitLeaf(tree.first, leafId, direction, newPaneId),
    second: splitLeaf(tree.second, leafId, direction, newPaneId),
  }
}

export function addTabToLeaf(tree: SplitNode, leafId: string, paneId: string): SplitNode {
  if (tree.type === 'leaf') {
    if (tree.id !== leafId) return tree
    const paneIds = tree.paneIds.includes(paneId) ? tree.paneIds : [...tree.paneIds, paneId]
    return { ...tree, paneIds, activePaneId: paneId }
  }
  return {
    ...tree,
    first: addTabToLeaf(tree.first, leafId, paneId),
    second: addTabToLeaf(tree.second, leafId, paneId),
  }
}

export function setActiveTabInLeaf(tree: SplitNode, leafId: string, paneId: string): SplitNode {
  if (tree.type === 'leaf') {
    if (tree.id !== leafId || !tree.paneIds.includes(paneId)) return tree
    return { ...tree, activePaneId: paneId }
  }
  return {
    ...tree,
    first: setActiveTabInLeaf(tree.first, leafId, paneId),
    second: setActiveTabInLeaf(tree.second, leafId, paneId),
  }
}

export function closePaneFromTree(tree: SplitNode, paneId: string): SplitNode | null {
  if (tree.type === 'leaf') {
    if (!tree.paneIds.includes(paneId)) return tree
    const nextIds = tree.paneIds.filter((id) => id !== paneId)
    if (nextIds.length === 0) return null
    const nextActive =
      tree.activePaneId === paneId ? (nextIds[nextIds.length - 1] ?? null) : tree.activePaneId
    return { ...tree, paneIds: nextIds, activePaneId: nextActive }
  }

  const nextFirst = closePaneFromTree(tree.first, paneId)
  const nextSecond = closePaneFromTree(tree.second, paneId)

  if (!nextFirst && !nextSecond) return null
  if (!nextFirst) return nextSecond
  if (!nextSecond) return nextFirst
  return { ...tree, first: nextFirst, second: nextSecond }
}

export function resizeSplitNode(tree: SplitNode, splitId: string, ratio: number): SplitNode {
  const clamped = Math.min(0.85, Math.max(0.15, ratio))
  if (tree.type === 'leaf') return tree
  if (tree.id === splitId) {
    return { ...tree, ratio: clamped }
  }
  return {
    ...tree,
    first: resizeSplitNode(tree.first, splitId, clamped),
    second: resizeSplitNode(tree.second, splitId, clamped),
  }
}

export function reorderTabInLeaf(
  tree: SplitNode,
  leafId: string,
  fromIdx: number,
  toIdx: number,
  pinnedIds: Set<string>,
): SplitNode {
  if (tree.type === 'leaf') {
    if (tree.id !== leafId) return tree
    if (fromIdx < 0 || fromIdx >= tree.paneIds.length || toIdx < 0 || toIdx >= tree.paneIds.length) {
      return tree
    }
    const next = [...tree.paneIds]
    const [moved] = next.splice(fromIdx, 1)
    if (!moved) return tree
    next.splice(toIdx, 0, moved)
    // Keep pinned tabs strictly before unpinned tabs
    const pinned = next.filter((id) => pinnedIds.has(id))
    const unpinned = next.filter((id) => !pinnedIds.has(id))
    return { ...tree, paneIds: [...pinned, ...unpinned] }
  }
  return {
    ...tree,
    first: reorderTabInLeaf(tree.first, leafId, fromIdx, toIdx, pinnedIds),
    second: reorderTabInLeaf(tree.second, leafId, fromIdx, toIdx, pinnedIds),
  }
}

export function findLeafContainingPane(tree: SplitNode, paneId: string): string | null {
  if (tree.type === 'leaf') {
    return tree.paneIds.includes(paneId) ? tree.id : null
  }
  return (
    findLeafContainingPane(tree.first, paneId) ?? findLeafContainingPane(tree.second, paneId)
  )
}

export function firstLeafId(tree: SplitNode): string {
  return tree.type === 'leaf' ? tree.id : firstLeafId(tree.first)
}
