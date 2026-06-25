// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { StepDef } from '@goodboy/types'
import { useWorkflowDrag } from './index'

const def = { id: 'sd-1', name: 'review' } as unknown as StepDef

const pointerEvent = (clientX: number, clientY: number) =>
  ({ preventDefault: vi.fn(), clientX, clientY }) as unknown as ReactPointerEvent

const params = (over: Partial<Parameters<typeof useWorkflowDrag>[0]> = {}) => ({
  enabled: true,
  onDropLibrary: vi.fn(),
  onReorder: vi.fn(),
  ...over,
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('useWorkflowDrag', () => {
  it('does not start a drag when disabled', () => {
    const { result } = renderHook(() => useWorkflowDrag(params({ enabled: false })))
    act(() => result.current.startLibraryDrag(def, pointerEvent(0, 0)))
    expect(result.current.drag).toBeNull()
    expect(result.current.ghost).toBeNull()
  })

  it('exposes a ghost descriptor anchored to the pointer once a drag begins', () => {
    const { result } = renderHook(() => useWorkflowDrag(params()))
    act(() => result.current.startLibraryDrag(def, pointerEvent(40, 50)))
    expect(result.current.ghost).toEqual({ label: 'review', x: 40, y: 50 })
  })

  it('reads the drop index from the [data-dropindex] zone under the pointer', () => {
    const zone = document.createElement('div')
    zone.setAttribute('data-dropindex', '2')
    document.body.appendChild(zone)
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(zone)

    const { result } = renderHook(() => useWorkflowDrag(params()))
    act(() => result.current.startLibraryDrag(def, pointerEvent(0, 0)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 })))
    expect(result.current.dropIndex).toBe(2)
  })

  it('clears the drop index when the pointer is over no zone', () => {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.createElement('span'))
    const { result } = renderHook(() => useWorkflowDrag(params()))
    act(() => result.current.startLibraryDrag(def, pointerEvent(0, 0)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 })))
    expect(result.current.dropIndex).toBeNull()
  })

  it('fires onDropLibrary with the step id and drop index on pointer release', () => {
    const zone = document.createElement('div')
    zone.setAttribute('data-dropindex', '3')
    document.body.appendChild(zone)
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(zone)

    const onDropLibrary = vi.fn()
    const { result } = renderHook(() => useWorkflowDrag(params({ onDropLibrary })))
    act(() => result.current.startLibraryDrag(def, pointerEvent(0, 0)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 })))
    act(() => window.dispatchEvent(new MouseEvent('pointerup')))
    expect(onDropLibrary).toHaveBeenCalledWith('sd-1', 3)
    expect(result.current.drag).toBeNull()
  })

  it('fires onReorder with the source and drop index when a step is dragged', () => {
    const zone = document.createElement('div')
    zone.setAttribute('data-dropindex', '4')
    document.body.appendChild(zone)
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(zone)

    const onReorder = vi.fn()
    const { result } = renderHook(() => useWorkflowDrag(params({ onReorder })))
    act(() => result.current.startStepDrag(1, 'Fix', pointerEvent(0, 0)))
    expect(result.current.ghost).toEqual({ label: 'Fix', x: 0, y: 0 })
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 })))
    act(() => window.dispatchEvent(new MouseEvent('pointerup')))
    expect(onReorder).toHaveBeenCalledWith(1, 4)
    expect(result.current.drag).toBeNull()
  })

  it('does not fire any drop handler when released over no zone', () => {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.createElement('span'))
    const onDropLibrary = vi.fn()
    const onReorder = vi.fn()
    const { result } = renderHook(() => useWorkflowDrag(params({ onDropLibrary, onReorder })))
    act(() => result.current.startLibraryDrag(def, pointerEvent(0, 0)))
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 5 })))
    act(() => window.dispatchEvent(new MouseEvent('pointerup')))
    expect(onDropLibrary).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.drag).toBeNull()
  })

  it('toggles body user-select for the duration of the drag', () => {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(null)
    const { result } = renderHook(() => useWorkflowDrag(params()))
    act(() => result.current.startLibraryDrag(def, pointerEvent(0, 0)))
    expect(document.body.style.userSelect).toBe('none')
    act(() => window.dispatchEvent(new MouseEvent('pointerup')))
    expect(document.body.style.userSelect).toBe('')
  })
})
