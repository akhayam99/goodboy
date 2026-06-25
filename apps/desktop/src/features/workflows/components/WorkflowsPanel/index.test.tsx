// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const { state } = vi.hoisted(() => ({
  state: {
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    stepLibrary: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<unknown>,
    loadPhaseTemplates: vi.fn(async () => undefined),
    loadStepLibrary: vi.fn(async () => undefined),
    savePhaseTemplate: vi.fn(async () => undefined),
    deleteWorkflow: vi.fn(async () => undefined),
    saveStepDef: vi.fn(async () => undefined),
    deleteStepDef: vi.fn(async () => undefined),
    resetWorkflows: vi.fn(async () => undefined),
  },
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))

vi.mock('@goodboy/core', () => ({ formatWorkflowFromNL: vi.fn(async () => null) }))

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}))

import { ToastProvider } from '../../../../app/components/Toast'
import { WorkflowsPanel } from './index'

const renderPanel = () =>
  render(
    <ToastProvider>
      <WorkflowsPanel workspaceId={'ws-1' as never} />
    </ToastProvider>,
  )

beforeEach(() => {
  state.phaseTemplates = {}
  state.stepLibrary = {}
  state.providers = []
  state.loadPhaseTemplates = vi.fn(async () => undefined)
  state.loadStepLibrary = vi.fn(async () => undefined)
  state.savePhaseTemplate = vi.fn(async () => undefined)
  state.deleteWorkflow = vi.fn(async () => undefined)
  state.saveStepDef = vi.fn(async () => undefined)
  state.deleteStepDef = vi.fn(async () => undefined)
  state.resetWorkflows = vi.fn(async () => undefined)
})
afterEach(cleanup)

const makeWorkflow = (overrides: Record<string, unknown> = {}) => ({
  id: 'wf-1',
  workspaceId: 'ws-1',
  name: 'My workflow',
  description: '',
  steps: [],
  isPreset: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

describe('WorkflowsPanel', () => {
  it('renders the empty-state copy when no workflows exist', () => {
    renderPanel()
    expect(screen.getByText(/no presets yet/i)).toBeDefined()
  })

  it('renders a New workflow button', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /new workflow/i })).toBeDefined()
  })

  it('loads phase templates and step library on mount', () => {
    renderPanel()
    expect(state.loadPhaseTemplates).toHaveBeenCalledWith('ws-1')
    expect(state.loadStepLibrary).toHaveBeenCalledWith('ws-1')
  })

  it('renders preset workflow names when they exist', () => {
    state.phaseTemplates = { 'ws-1': [makeWorkflow({ name: 'Plan and build' })] }
    renderPanel()
    expect(screen.getByText('Plan and build')).toBeDefined()
  })

  it('hides soft-deleted (deletedAt) workflows from the preset list', () => {
    state.phaseTemplates = {
      'ws-1': [
        makeWorkflow({ name: 'Visible workflow' }),
        makeWorkflow({
          id: 'wf-2',
          name: 'Deleted workflow',
          deletedAt: '2024-06-01T00:00:00.000Z',
        }),
      ],
    }
    renderPanel()
    expect(screen.getByText('Visible workflow')).toBeDefined()
    expect(screen.queryByText('Deleted workflow')).toBeNull()
  })

  it('lists draft workflows (isPreset=false) alongside approved ones', () => {
    state.phaseTemplates = {
      'ws-1': [
        makeWorkflow({ name: 'Approved preset' }),
        makeWorkflow({ id: 'wf-3', name: 'Draft workflow', isPreset: false }),
      ],
    }
    renderPanel()
    expect(screen.getByText('Approved preset')).toBeDefined()
    // drafts now appear with a status pill rather than being hidden
    expect(screen.getByText('Draft workflow')).toBeDefined()
  })

  it('shows empty state when every template is soft-deleted', () => {
    state.phaseTemplates = {
      'ws-1': [
        makeWorkflow({ id: 'wf-d', name: 'Gone', deletedAt: '2024-01-01T00:00:00.000Z' }),
        makeWorkflow({ id: 'wf-d2', name: 'Also gone', deletedAt: '2024-01-02T00:00:00.000Z' }),
      ],
    }
    renderPanel()
    expect(screen.getByText(/no presets yet/i)).toBeDefined()
  })
})
