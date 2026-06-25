// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ConfigBundleImportResult } from '@goodboy/types'

import { ImportConfigDialog } from './index'

afterEach(cleanup)

describe('ImportConfigDialog', () => {
  it('renders the error title when an error is provided', () => {
    render(<ImportConfigDialog open result={null} error="something blew up" onClose={vi.fn()} />)
    expect(screen.getByText(/import failed/i)).toBeDefined()
    expect(screen.getByText(/something blew up/i)).toBeDefined()
  })

  it('renders the success title and counts when import was ok', () => {
    const result: ConfigBundleImportResult = {
      ok: true,
      stats: {
        workspaces: 2,
        skills: 0,
        workflows: 3,
        permissionRules: 4,
        budgetRules: 5,
      },
    } as unknown as ConfigBundleImportResult
    render(<ImportConfigDialog open result={result} error={null} onClose={vi.fn()} />)
    expect(screen.getByText(/import complete/i)).toBeDefined()
    const term = screen.getByText(/^workspaces:$/i)
    expect(term).toBeDefined()
    const row = term.closest('div')
    expect(row?.textContent).toMatch(/workspaces:\s*2/i)
  })

  it('renders validation errors keyed by field with messages', () => {
    const result: ConfigBundleImportResult = {
      ok: false,
      errors: [{ field: 'workspaces[0].name', message: 'is required' }],
      stats: {} as never,
    } as unknown as ConfigBundleImportResult
    render(<ImportConfigDialog open result={result} error={null} onClose={vi.fn()} />)
    expect(screen.getByText('workspaces[0].name')).toBeDefined()
    expect(screen.getByText(/is required/i)).toBeDefined()
  })
})
