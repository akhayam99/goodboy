import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionId } from '@goodboy/types'
import { OpenSessionButton } from './index'

const openSession = vi.fn()

vi.mock('../../hooks/useOpenSession', () => ({
  useOpenSession: () => openSession,
}))

afterEach(cleanup)

describe('OpenSessionButton', () => {
  it('renders the default label', () => {
    render(<OpenSessionButton sessionId={'s1' as SessionId} />)
    expect(screen.getByRole('button', { name: /open session/i })).toBeTruthy()
  })

  it('opens the session and runs onOpened on click', () => {
    const onOpened = vi.fn()
    render(<OpenSessionButton sessionId={'s1' as SessionId} onOpened={onOpened} />)
    fireEvent.click(screen.getByRole('button', { name: /open session/i }))
    expect(openSession).toHaveBeenCalledWith('s1', onOpened)
  })
})
