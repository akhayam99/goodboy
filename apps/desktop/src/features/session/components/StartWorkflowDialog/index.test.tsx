// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    attachWorkflowToSession: vi.fn(async () => undefined),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../workflows/components/WorkflowPlanner', () => ({
  WorkflowPlanner: () => null,
}));

import { StartWorkflowDialog } from './index';

const session: Session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'do a thing',
  providerPreference: { defaultProvider: 'anthropic' },
} as unknown as Session;

beforeEach(() => {
  state.phaseTemplates = {};
  state.attachWorkflowToSession = vi.fn(async () => undefined);
  toastMock.mockReset();
});
afterEach(cleanup);

describe('StartWorkflowDialog', () => {
  it('renders the dialog title when open', () => {
    render(<StartWorkflowDialog open onClose={vi.fn()} session={session} />);
    expect(screen.getByText(/start a workflow/i)).toBeDefined();
  });

  it('renders the describe-your-own entry in the rail', () => {
    render(<StartWorkflowDialog open onClose={vi.fn()} session={session} />);
    expect(screen.getByRole('button', { name: /describe your own/i })).toBeDefined();
  });

  it('shows empty-state copy when no workflow presets exist', () => {
    render(<StartWorkflowDialog open onClose={vi.fn()} session={session} />);
    expect(screen.getByText(/no presets yet/i)).toBeDefined();
  });
});
