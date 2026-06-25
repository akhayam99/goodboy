// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { useKeyboardShortcut } from '../../shared/hooks/useKeyboardShortcut'

afterEach(cleanup)

function pressKey(
  key: string,
  opts: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {},
) {
  fireEvent.keyDown(window, { key, ...opts })
}

describe('useKeyboardShortcut', () => {
  it('fires handler on cmd+,', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut('cmd+,', handler))
    pressKey(',', { metaKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('fires handler on cmd+/', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut('cmd+/', handler))
    pressKey('/', { metaKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('fires handler on cmd+.', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut('cmd+.', handler))
    pressKey('.', { metaKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not fire when key does not match', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut('cmd+,', handler))
    pressKey('x', { metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire cmd+, when meta modifier absent', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut('cmd+,', handler))
    pressKey(',')
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire when focus is inside an input (ignoreInInputs=true default)', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut('cmd+,', handler))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    pressKey(',', { metaKey: true })
    expect(handler).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })

  it('fires when focus is inside an input if ignoreInInputs=false', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut('cmd+,', handler, { ignoreInInputs: false }))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    pressKey(',', { metaKey: true })
    expect(handler).toHaveBeenCalledOnce()

    document.body.removeChild(input)
  })

  it('cleans up listener on unmount', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcut('cmd+,', handler))
    unmount()
    pressKey(',', { metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })
})
