// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Workspace, WorkspaceId } from '@goodboy/types'
import { SETTING_REOPEN_LAST } from '../../../settings/settings'

const { state } = vi.hoisted(() => ({
  state: {
    workspaces: [] as ReadonlyArray<Workspace>,
    currentWorkspace: null as Workspace | null,
    shown: new Set<WorkspaceId>(),
    openWorkspace: vi.fn(async () => undefined),
    saveSetting: vi.fn(async () => undefined),
    settings: {} as Record<string, string>,
  },
}))

vi.mock('../../../../store', () => ({
  useWorkspaces: () => state.workspaces,
  useWorkspaceHasUnread: () => false,
  useAppStore: (
    selector: (s: {
      openWorkspace: typeof state.openWorkspace
      saveSetting: typeof state.saveSetting
      settings: Record<string, string>
    }) => unknown,
  ) =>
    selector({
      openWorkspace: state.openWorkspace,
      saveSetting: state.saveSetting,
      settings: state.settings,
    }),
}))

import { WorkspaceLauncher } from './index'

beforeEach(() => {
  state.workspaces = [
    { id: 'ws-a', name: 'alpha', rootPath: '/repos/alpha' } as Workspace,
    { id: 'ws-b', name: 'bravo', rootPath: '/repos/bravo' } as Workspace,
  ]
  state.currentWorkspace = null
  state.shown = new Set()
  state.openWorkspace = vi.fn(async () => undefined)
  state.saveSetting = vi.fn(async () => undefined)
  state.settings = {}
})
afterEach(cleanup)

describe('WorkspaceLauncher', () => {
  it('opens a recent workspace on click', () => {
    render(<WorkspaceLauncher />)
    fireEvent.click(screen.getByText('alpha'))
    expect(state.openWorkspace).toHaveBeenCalledWith('ws-a', 'alpha')
  })

  it('persists the reopen-last preference', () => {
    render(<WorkspaceLauncher />)
    fireEvent.click(screen.getByLabelText(/reopen last workspace/i))
    expect(state.saveSetting).toHaveBeenCalledWith(SETTING_REOPEN_LAST, '1')
  })
})
