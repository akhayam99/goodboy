// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { ErrorBoundary } from './index'

afterEach(cleanup)

function Boom({ throwNow }: { throwNow: boolean }): null {
  if (throwNow) {
    throw new Error('kaboom')
  }
  return null
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>safe content</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('safe content')).toBeDefined()
  })

  it('renders the recovery alert when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <Boom throwNow />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText(/something went wrong/i)).toBeDefined()
    expect(screen.getByText(/kaboom/)).toBeDefined()
    consoleError.mockRestore()
  })

  it('exposes a reload button that calls window.location.reload', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload },
    })
    render(
      <ErrorBoundary>
        <Boom throwNow />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: /reload/i }))
    expect(reload).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})
