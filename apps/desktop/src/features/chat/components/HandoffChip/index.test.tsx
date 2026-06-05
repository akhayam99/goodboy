// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { extractHandoffMock, state } = vi.hoisted(() => ({
  extractHandoffMock: vi.fn<(text: string) => unknown>(() => null),
  state: {
    sessions: [{ id: 'sess-1', workflowRuns: [] as ReadonlyArray<string> }],
    sessionNudges: {} as Record<string, unknown>,
    spawnAgent: vi.fn(async () => undefined),
    acceptSessionNudgeHandoff: vi.fn(async () => undefined),
  },
}));

vi.mock('@goodboy/core', () => ({ extractHandoff: extractHandoffMock }));
vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { HandoffChip } from './index';

beforeEach(() => {
  extractHandoffMock.mockReset();
  state.sessions = [{ id: 'sess-1', workflowRuns: [] }];
  state.sessionNudges = {};
  state.spawnAgent = vi.fn(async () => undefined);
  state.acceptSessionNudgeHandoff = vi.fn(async () => undefined);
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

  it('spawns the suggested agent when the chip is clicked', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: null });
    render(<HandoffChip assistantText="x" sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByTestId('handoff-chip'));
    expect(state.spawnAgent).toHaveBeenCalledWith('sess-1', { kindOverride: 'implementer' });
  });
});
