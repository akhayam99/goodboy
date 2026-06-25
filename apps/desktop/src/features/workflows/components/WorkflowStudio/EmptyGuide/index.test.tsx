// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EmptyGuide } from './index'

afterEach(cleanup)

describe('EmptyGuide', () => {
  it('explains the page with a tagline and three ordered steps', () => {
    render(<EmptyGuide onNew={() => undefined} hasPresets={false} />)
    expect(screen.getByText(/run it on any session/i)).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText(/step library on the right/i)).toBeDefined()
  })

  it('frames the first run when no presets exist yet', () => {
    render(<EmptyGuide onNew={() => undefined} hasPresets={false} />)
    expect(screen.getByText(/design your first workflow/i)).toBeDefined()
    expect(screen.getByText(/5 presets ship by default/i)).toBeDefined()
  })

  it('points returning users to the preset list', () => {
    render(<EmptyGuide onNew={() => undefined} hasPresets />)
    expect(screen.getByText(/build a workflow/i)).toBeDefined()
    expect(screen.getByText(/pick a preset on the left to edit/i)).toBeDefined()
  })

  it('starts a new workflow from the call to action', () => {
    const onNew = vi.fn()
    render(<EmptyGuide onNew={onNew} hasPresets={false} />)
    fireEvent.click(screen.getByRole('button', { name: /new workflow/i }))
    expect(onNew).toHaveBeenCalledOnce()
  })
})
