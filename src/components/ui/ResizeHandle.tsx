import { useRef, useState } from 'react'

interface ResizeHandleProps {
  /** 'vertical' = left/right bar (col-resize), 'horizontal' = top/bottom bar (row-resize) */
  orientation: 'vertical' | 'horizontal'
  onDragDelta: (deltaPx: number) => void
  onReset?: () => void
  ariaLabel?: string
}

/**
 * Pointer-captured resize handle with a generous 7px hit area centered over a 1px hairline.
 * Works smoothly even when dragging rapidly across WebGL xterm canvases.
 */
export function ResizeHandle({
  orientation,
  onDragDelta,
  onReset,
  ariaLabel = 'Resize panel',
}: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false)
  const lastPosRef = useRef(0)

  const isVertical = orientation === 'vertical'

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      title="Drag to resize · Double-click to reset"
      onDoubleClick={() => onReset?.()}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        lastPosRef.current = isVertical ? e.clientX : e.clientY
        setDragging(true)
        document.body.style.userSelect = 'none'
        document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize'
      }}
      onPointerMove={(e) => {
        if (!dragging) return
        const pos = isVertical ? e.clientX : e.clientY
        const delta = pos - lastPosRef.current
        if (delta !== 0) {
          lastPosRef.current = pos
          onDragDelta(delta)
        }
      }}
      onPointerUp={(e) => {
        if (!dragging) return
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
        setDragging(false)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }}
      onPointerCancel={() => {
        setDragging(false)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }}
      className={`group relative z-10 shrink-0 select-none ${
        isVertical
          ? 'h-full w-[5px] -mx-[2px] cursor-col-resize'
          : 'w-full h-[5px] -my-[2px] cursor-row-resize'
      }`}
    >
      <div
        className={`pointer-events-none absolute transition-colors ${
          isVertical ? 'inset-y-0 left-[2px] w-px' : 'inset-x-0 top-[2px] h-px'
        } ${dragging ? 'bg-cobalt shadow-[0_0_6px_rgba(47,111,255,0.8)]' : 'bg-line group-hover:bg-cobalt/80'}`}
      />
    </div>
  )
}
