// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Session } from '@goodboy/types'

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    renameTask: vi.fn(async () => undefined),
    loadDetectedEditors: vi.fn(async () => undefined),
    unarchiveTask: vi.fn(async () => undefined),
    sessionExternalTasks: {} as Record<string, unknown>,
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
  },
  toastMock: vi.fn(),
}))

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}))

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}))

vi.mock('../../../session/components/SessionStageBadge', () => ({
  SessionStageBadge: () => null,
}))

vi.mock('../../../../shared/components/OverflowMenu', () => ({
  OverflowMenu: ({ label }: { label: string }) => (
    <button type="button" aria-label={label}>
      menu
    </button>
  ),
}))

vi.mock('../../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(async () => undefined),
}))

import { SessionDetailPanel } from './index'

const session: Session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'refactor auth',
  state: { kind: 'idle' },
} as unknown as Session

beforeEach(() => {
  state.sessionWorktrees = {}
  state.sessionExternalTasks = {}
  state.detectedEditors = []
  toastMock.mockReset()
})
afterEach(cleanup)

describe('SessionDetailPanel', () => {
  it('renders the session goal text', () => {
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />)
    expect(screen.getByText(/refactor auth/i)).toBeDefined()
  })

  it('opens session settings from the gear button', () => {
    const onOpenSessionSettings = vi.fn()
    render(<SessionDetailPanel session={session} onOpenSessionSettings={onOpenSessionSettings} />)
    fireEvent.click(screen.getByRole('button', { name: /session settings/i }))
    expect(onOpenSessionSettings).toHaveBeenCalledOnce()
  })

  it('renders the open-worktree folder trigger plus archive and delete actions', () => {
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />)
    expect(screen.getByRole('button', { name: /open worktree/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /archive session/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /delete session/i })).toBeDefined()
  })

  it('does not render an external task chip when none is mapped', () => {
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /studio/i })).toBeNull()
  })

  it('renders the external task chip (full variant) when a task is mapped', () => {
    state.sessionExternalTasks = {
      'sess-1': {
        sessionId: 'sess-1',
        provider: 'linear',
        externalId: 'ext-1',
        identifier: 'GB-9',
        url: 'https://linear.app/x',
        title: 'wire metadata',
        createdAt: '2026-06-22T00:00:00.000Z',
      },
    }
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />)
    expect(screen.getByRole('button', { name: /open GB-9 in Linear studio/i })).toBeDefined()
    expect(screen.getByText('GB-9')).toBeDefined()
    expect(screen.getByText('wire metadata')).toBeDefined()
  })
})
