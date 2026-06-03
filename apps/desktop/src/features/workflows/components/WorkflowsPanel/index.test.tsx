// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    stepLibrary: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<unknown>,
    loadPhaseTemplates: vi.fn(async () => undefined),
    loadStepLibrary: vi.fn(async () => undefined),
    savePhaseTemplate: vi.fn(async () => undefined),
    deleteWorkflow: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { WorkflowsPanel } from './index';

beforeEach(() => {
  state.phaseTemplates = {};
  state.stepLibrary = {};
  state.providers = [];
  state.loadPhaseTemplates = vi.fn(async () => undefined);
  state.loadStepLibrary = vi.fn(async () => undefined);
  state.savePhaseTemplate = vi.fn(async () => undefined);
  state.deleteWorkflow = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('WorkflowsPanel', () => {
  it('renders the empty-state copy when no workflows exist', () => {
    render(<WorkflowsPanel workspaceId={'ws-1' as never} />);
    expect(screen.getByText(/no presets here yet/i)).toBeDefined();
  });

  it('renders a New workflow button', () => {
    render(<WorkflowsPanel workspaceId={'ws-1' as never} />);
    expect(screen.getByRole('button', { name: /new workflow/i })).toBeDefined();
  });

  it('loads phase templates on mount', () => {
    render(<WorkflowsPanel workspaceId={'ws-1' as never} />);
    expect(state.loadPhaseTemplates).toHaveBeenCalledWith('ws-1');
  });
});
