// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

const { extractHandoffMock, showToast, state } = vi.hoisted(() => ({
  extractHandoffMock: vi.fn<(text: string) => unknown>(() => null),
  showToast: vi.fn<(kind: string, message: string, opts?: ToastOptions) => void>(),
  state: {
    sessions: [{ id: 'sess-1', workflowRuns: [] as ReadonlyArray<string> }],
    sessionNudges: {} as Record<string, unknown>,
    spawnAgent: vi.fn(async () => 'agent-impl'),
    acceptSessionNudgeHandoff: vi.fn(async () => 'agent-accepted'),
    selectAgent: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
  },
}));

vi.mock('@goodboy/core', () => ({ extractHandoff: extractHandoffMock }));
vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

import { HandoffChip } from './index';

beforeEach(() => {
  extractHandoffMock.mockReset();
  showToast.mockClear();
  state.sessions = [{ id: 'sess-1', workflowRuns: [] }];
  state.sessionNudges = {};
  state.spawnAgent = vi.fn(async () => 'agent-impl');
  state.acceptSessionNudgeHandoff = vi.fn(async () => 'agent-accepted');
  state.selectAgent = vi.fn(async () => undefined);
  state.setActiveLens = vi.fn();
});
afterEach(cleanup);

describe('HandoffChip', () => {
  it('renders nothing when no handoff is detected', () => {
    extractHandoffMock.mockReturnValue(null);
    const { container } = render(<HandoffChip assistantText="x" sessionId={'sess-1' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the session belongs to a workflow', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: 'r' });
    state.sessions = [{ id: 'sess-1', workflowRuns: ['w'] }];
    const { container } = render(<HandoffChip assistantText="x" sessionId={'sess-1' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('spawns the suggested agent without stealing focus when the chip is clicked', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: null });
    render(<HandoffChip assistantText="x" sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByTestId('handoff-chip'));
    expect(state.spawnAgent).toHaveBeenCalledWith('sess-1', {
      kindOverride: 'implementer',
      focus: 'none',
    });
  });

  it('accepts the live nudge, reports it started, and opens the agent only from the toast', async () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: null });
    state.sessionNudges = {
      'sess-1': { id: 'nudge-1', kind: 'handoff-suggested', targetKind: 'implementer' },
    };
    render(<HandoffChip assistantText="x" sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByTestId('handoff-chip'));

    await waitFor(() => expect(state.acceptSessionNudgeHandoff).toHaveBeenCalledWith('sess-1'));
    await waitFor(() => expect(showToast).toHaveBeenCalledOnce());
    expect(state.spawnAgent).not.toHaveBeenCalled();
    expect(state.selectAgent).not.toHaveBeenCalled();
    const opts = showToast.mock.calls[0]![2];
    expect(opts?.action?.label).toBe('Open the agent');

    opts?.action?.onClick();

    await waitFor(() => expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-accepted'));
    expect(state.setActiveLens).toHaveBeenCalledWith('sess-1', 'agents');
  });
});
