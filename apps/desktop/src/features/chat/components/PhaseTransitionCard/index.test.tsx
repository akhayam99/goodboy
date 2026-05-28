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
} as Extract<TranscriptItem, { kind: 'step_transition' }>;

describe('PhaseTransitionCard', () => {
  it('renders the step transition header with both step names', () => {
    render(<PhaseTransitionCard item={item} />);
    expect(screen.getByText(/discover/i)).toBeDefined();
    expect(screen.getByText(/plan/i)).toBeDefined();
  });

  it('reveals the carry-forward context when expanded', () => {
    render(<PhaseTransitionCard item={item} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('carry me forward')).toBeDefined();
  });
});
