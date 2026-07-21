// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TranscriptItem } from '../../utils/transcript-items';
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

  it('reveals the carry-forward context when expanded', () => {
    render(<PhaseTransitionCard item={item} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('carry me forward')).toBeDefined();
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
