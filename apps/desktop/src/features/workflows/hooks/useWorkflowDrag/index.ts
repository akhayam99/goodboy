import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { StepDef } from '@goodboy/types'

type Drag =
  | { kind: 'library'; stepDefId: string; label: string }
  | { kind: 'step'; fromIndex: number; label: string }

export type DragGhostDescriptor = { label: string; x: number; y: number }

type Params = {
  enabled: boolean
  onDropLibrary: (stepDefId: string, atIndex: number) => void
  onReorder: (fromIndex: number, atIndex: number) => void
}

export const useWorkflowDrag = ({ enabled, onDropLibrary, onReorder }: Params) => {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const dragRef = useRef(drag)
  dragRef.current = drag
  const dropIndexRef = useRef(dropIndex)
  dropIndexRef.current = dropIndex
  const onDropLibraryRef = useRef(onDropLibrary)
  onDropLibraryRef.current = onDropLibrary
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder

  const startLibraryDrag = (def: StepDef, e: ReactPointerEvent) => {
    if (!enabled) {
      return
    }
    e.preventDefault()
    setDrag({ kind: 'library', stepDefId: def.id, label: def.name })
    setDragPos({ x: e.clientX, y: e.clientY })
    setDropIndex(null)
  }

  const startStepDrag = (fromIndex: number, label: string, e: ReactPointerEvent) => {
    if (!enabled) {
      return
    }
    e.preventDefault()
    setDrag({ kind: 'step', fromIndex, label })
    setDragPos({ x: e.clientX, y: e.clientY })
    setDropIndex(null)
  }

  useEffect(() => {
    if (!drag) {
      return
    }
    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    const onMove = (e: PointerEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY })
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const zone = el?.closest<HTMLElement>('[data-dropindex]')
      setDropIndex(zone ? Number(zone.dataset.dropindex) : null)
    }
    const onUp = () => {
      const d = dragRef.current
      const di = dropIndexRef.current
      if (d && di !== null) {
        if (d.kind === 'library') {
          onDropLibraryRef.current(d.stepDefId, di)
        } else {
          onReorderRef.current(d.fromIndex, di)
        }
      }
      setDrag(null)
      setDropIndex(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = prevUserSelect
    }
  }, [drag])

  const ghost: DragGhostDescriptor | null = drag
    ? { label: drag.label, x: dragPos.x, y: dragPos.y }
    : null

  return { drag, dragPos, dropIndex, setDropIndex, startLibraryDrag, startStepDrag, ghost }
}
