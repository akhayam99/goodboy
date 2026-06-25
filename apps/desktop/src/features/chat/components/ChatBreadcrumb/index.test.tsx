// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Session } from '@goodboy/types'

type MockState = {
  workspaces: ReadonlyArray<{ id: string; name: string }>
  selectedAgentId: Record<string, string>
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>
  sessionWorkflows: Record<string, ReadonlyArray<unknown>>
  agentKindOverride: Record<string, string>
  selectAgent: ReturnType<typeof vi.fn>
}

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    workspaces: [{ id: 'ws-1', name: 'goodboy' }],
    selectedAgentId: {},
    sessionPhaseRuns: {},
    sessionWorkflows: {},
    agentKindOverride: {},
    selectAgent: vi.fn(async () => undefined),
  },
}))

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
}))

import { ChatBreadcrumb } from './index'

beforeEach(() => {
  state.workspaces = [{ id: 'ws-1', name: 'goodboy' }]
  state.selectedAgentId = {}
  state.sessionPhaseRuns = {}
  state.sessionWorkflows = {}
  state.agentKindOverride = {}
  state.selectAgent = vi.fn(async () => undefined)
})
afterEach(cleanup)

const childRun = {
  id: 'child-1',
  name: 'implementer-1',
  parentAgentId: 'parent-1',
  status: 'running',
}
const parentRun = { id: 'parent-1', name: 'orchestrator', parentAgentId: null, status: 'running' }

const session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'fix tests',
  workflowRuns: [],
} as unknown as Session

describe('ChatBreadcrumb', () => {
  it('renders the workspace name and the session goal', () => {
    render(<ChatBreadcrumb session={session} />)
    expect(screen.getByText('goodboy')).toBeDefined()
    expect(screen.getByText('fix tests')).toBeDefined()
  })

  it('falls back to "untitled session" when the goal is empty', () => {
    const blank = { ...session, goal: '   ' } as Session
    render(<ChatBreadcrumb session={blank} />)
    expect(screen.getByText('untitled session')).toBeDefined()
  })

  it('renders an explicit no-workspace label when none is linked', () => {
    state.workspaces = []
    render(<ChatBreadcrumb session={session} />)
    expect(screen.getByText('no workspace')).toBeDefined()
  })

  it('renders the workspace name as plain text, not a button', () => {
    const spy = vi.fn()
    window.addEventListener('goodboy:open-workspace-settings', spy)
    render(<ChatBreadcrumb session={session} />)
    expect(screen.queryByRole('button', { name: 'goodboy' })).toBeNull()
    fireEvent.click(screen.getByText('goodboy'))
    expect(spy).not.toHaveBeenCalled()
    window.removeEventListener('goodboy:open-workspace-settings', spy)
  })
})

describe('ChatBreadcrumb, parent navigation', () => {
  it('shows a parent crumb when the selected agent was spawned by another agent', () => {
    state.selectedAgentId = { 'sess-1': 'child-1' }
    state.sessionPhaseRuns = { 'sess-1': [parentRun, childRun] }
    render(<ChatBreadcrumb session={session} />)
    expect(screen.getByRole('button', { name: /orchestrator/ })).toBeTruthy()
  })

  it('navigates to the parent agent and reveals the chat on click', () => {
    state.selectedAgentId = { 'sess-1': 'child-1' }
    state.sessionPhaseRuns = { 'sess-1': [parentRun, childRun] }
    const reveal = vi.fn()
    window.addEventListener('goodboy:reveal-chat', reveal)
    render(<ChatBreadcrumb session={session} />)
    fireEvent.click(screen.getByRole('button', { name: /orchestrator/ }))
    expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'parent-1')
    expect(reveal).toHaveBeenCalled()
    window.removeEventListener('goodboy:reveal-chat', reveal)
  })

  it('shows no parent crumb when the selected agent is a top-level run', () => {
    state.selectedAgentId = { 'sess-1': 'parent-1' }
    state.sessionPhaseRuns = { 'sess-1': [parentRun, childRun] }
    render(<ChatBreadcrumb session={session} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows no parent crumb when nothing is selected', () => {
    state.sessionPhaseRuns = { 'sess-1': [parentRun, childRun] }
    render(<ChatBreadcrumb session={session} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows no parent crumb when the parent run is absent from phaseRuns', () => {
    state.selectedAgentId = { 'sess-1': 'child-1' }
    state.sessionPhaseRuns = { 'sess-1': [childRun] }
    render(<ChatBreadcrumb session={session} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
