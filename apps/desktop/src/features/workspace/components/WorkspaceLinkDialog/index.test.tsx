// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { state, validateMock } = vi.hoisted(() => ({
  state: {
    addWorkspace: vi.fn(async () => ({ id: 'ws-new' })),
    setCurrentWorkspace: vi.fn(async () => undefined),
    workspaces: [] as ReadonlyArray<{ id: string }>,
  },
  validateMock: vi.fn(async () => ({ isRepo: true })),
}))

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      addWorkspace: typeof state.addWorkspace
      setCurrentWorkspace: typeof state.setCurrentWorkspace
    }) => T,
  ) =>
    selector({
      addWorkspace: state.addWorkspace,
      setCurrentWorkspace: state.setCurrentWorkspace,
    }),
  useWorkspaces: () => state.workspaces,
}))

vi.mock('../../../../shared/lib/repo', () => ({
  validateGitRepo: validateMock,
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => '/picked/path'),
}))

import { WorkspaceLinkDialog } from './index'

beforeEach(() => {
  state.addWorkspace = vi.fn(async () => ({ id: 'ws-new' }))
  state.setCurrentWorkspace = vi.fn(async () => undefined)
  state.workspaces = []
  validateMock.mockResolvedValue({ isRepo: true })
})
afterEach(cleanup)

describe('WorkspaceLinkDialog', () => {
  it('renders the dialog title and the repository helper hint', () => {
    render(<WorkspaceLinkDialog open onClose={vi.fn()} />)
    expect(screen.getByText(/point goodboy at a local git repo/i)).toBeDefined()
  })

  it('renders a Cancel button that closes the dialog', () => {
    const onClose = vi.fn()
    render(<WorkspaceLinkDialog open onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('validates the typed path and surfaces a valid-repo confirmation', async () => {
    render(<WorkspaceLinkDialog open onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('/path/to/repo'), {
      target: { value: '/some/repo' },
    })
    await waitFor(() => screen.getByText(/valid git repository/i), { timeout: 2000 })
    expect(validateMock).toHaveBeenCalledWith('/some/repo')
  })
})
