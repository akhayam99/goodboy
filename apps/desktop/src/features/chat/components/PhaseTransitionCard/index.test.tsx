// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';

const retryStepSummary = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: { retryStepSummary: typeof retryStepSummary }) => T) =>
    selector({ retryStepSummary }),
}));

import { PhaseTransitionCard } from './index';

afterEach(cleanup);

const item = {
  kind: 'step_transition',
  key: 'phase-1',
  at: '2026-05-28T03:00:00Z',
  fromStep: { ordinal: 0, name: 'discover' },
  toStep: { ordinal: 1, name: 'plan' },
  carryForwardContext: 'carry me forward',
} satisfies Extract<TranscriptItem, { kind: 'step_transition' }>;

describe('PhaseTransitionCard', () => {
  it('renders the step transition header with both step names', () => {
    render(<PhaseTransitionCard item={item} />);
    expect(screen.getByText(/discover/i)).toBeDefined();
    expect(screen.getByText(/plan/i)).toBeDefined();
  });

  it('keeps the carry-forward context collapsed by default', () => {
    render(<PhaseTransitionCard item={item} />);
    expect(screen.queryByText('carry me forward')).toBeNull();
  });

  it('renders plain legacy context when expanded', () => {
    render(<PhaseTransitionCard item={item} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('carry me forward')).toBeDefined();
  });

  it('strips the redundant workflow heading and renders structured sections', () => {
    const structuredItem = {
      ...item,
      carryForwardContext: [
        '## workflow handoff',
        '### step 1 output: discover',
        'Ready to build.',
        '### earlier steps',
        '- step 0 (scope): Requirements settled.',
      ].join('\n'),
    } satisfies Extract<TranscriptItem, { kind: 'step_transition' }>;
    render(<PhaseTransitionCard item={structuredItem} />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByRole('heading', { name: 'workflow handoff' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'step 1 output: discover' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'earlier steps' })).toBeDefined();
    expect(screen.getByText('step 0 (scope): Requirements settled.')).toBeDefined();
  });

  it('renders the degraded handoff badge only when degraded', () => {
    const { rerender } = render(<PhaseTransitionCard item={item} />);
    expect(screen.queryByText('degraded handoff')).toBeNull();

    const degradedItem = {
      ...item,
      degraded: true,
    } satisfies Extract<TranscriptItem, { kind: 'step_transition' }>;
    rerender(<PhaseTransitionCard item={degradedItem} />);
    expect(screen.getByText('degraded handoff')).toBeDefined();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/received a deterministic copy/i)).toBeDefined();
  });

  it('retries a degraded summary from the transition card', () => {
    const degradedItem = {
      ...item,
      degraded: true,
      sessionId: 'session-1' as SessionId,
      fromAgentId: 'agent-1' as AgentId,
    } satisfies Extract<TranscriptItem, { kind: 'step_transition' }>;
    render(<PhaseTransitionCard item={degradedItem} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry summary' }));

    expect(retryStepSummary).toHaveBeenCalledWith({
      sessionId: 'session-1',
      agentId: 'agent-1',
    });
  });

  it('renders the step duration when present', () => {
    const timedItem = {
      ...item,
      durationMs: 252_000,
    } satisfies Extract<TranscriptItem, { kind: 'step_transition' }>;
    render(<PhaseTransitionCard item={timedItem} />);
    expect(screen.getByText('4m 12s')).toBeDefined();
  });
});
