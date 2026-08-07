// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { OrchestratorDecisionCard } from './index';

afterEach(cleanup);

const item = {
  kind: 'orchestrator_decision',
  key: 'orchestrator-1',
  action: 'next',
  reason: 'the gate landed so the tests come next',
  stepName: 'write the gate tests',
  at: '2026-05-28T03:00:00Z' as IsoDateTime,
} satisfies Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;

const withNote = {
  ...item,
  operatorNote: 'the gate is in place but its tests are missing',
} satisfies Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;

describe('OrchestratorDecisionCard', () => {
  it('renders the operator note when the decision carries one', () => {
    render(<OrchestratorDecisionCard item={withNote} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('the gate is in place but its tests are missing')).toBeDefined();
  });

  it('keeps the operator note separate from the orchestrator reason', () => {
    render(<OrchestratorDecisionCard item={withNote} />);
    fireEvent.click(screen.getByRole('button'));
    const note = screen.getByTestId('orchestrator-decision-note');
    expect(note.textContent).toContain('the gate is in place but its tests are missing');
    expect(note.textContent).not.toContain('the gate landed so the tests come next');
    expect(screen.getByText('the gate landed so the tests come next')).toBeDefined();
  });

  it('flags a decision that carries a note while it is still collapsed', () => {
    render(<OrchestratorDecisionCard item={withNote} />);
    expect(screen.getByTestId('orchestrator-decision-note-badge')).toBeDefined();
  });

  it('renders no note surface when the decision has none', () => {
    render(<OrchestratorDecisionCard item={item} />);
    expect(screen.queryByTestId('orchestrator-decision-note-badge')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByTestId('orchestrator-decision-note')).toBeNull();
    expect(screen.getByText('the gate landed so the tests come next')).toBeDefined();
  });

  it('ignores a note that is only whitespace', () => {
    const blank = {
      ...item,
      operatorNote: '   ',
    } satisfies Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;
    render(<OrchestratorDecisionCard item={blank} />);
    expect(screen.queryByTestId('orchestrator-decision-note-badge')).toBeNull();
  });
});
