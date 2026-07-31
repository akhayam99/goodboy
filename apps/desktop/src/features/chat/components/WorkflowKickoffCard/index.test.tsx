// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TranscriptItem } from '../../utils/transcript-items';
import { WorkflowKickoffCard } from './index';

afterEach(cleanup);

const parsedItem = {
  kind: 'workflow_kickoff',
  key: 'kickoff-1',
  at: '2026-05-28T03:00:00Z',
  goal: 'Ship the onboarding wizard',
  instructions: 'Focus on the providers step only.',
  marker: 'Complete ONLY this workflow step.',
  raw: 'raw kickoff text',
  parsed: true,
} as Extract<TranscriptItem, { kind: 'workflow_kickoff' }>;

const expand = () => fireEvent.click(screen.getByRole('button', { expanded: false }));

describe('WorkflowKickoffCard', () => {
  it('always shows the goal in full, never behind the chevron', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    const goal = screen.getByText('Ship the onboarding wizard');
    expect(goal).toBeDefined();
    expect(goal.className).not.toContain('truncate');
    expect(goal.className).not.toContain('line-clamp');
    expect(screen.getByText(/goal/i)).toBeDefined();
  });

  it('keeps instructions and marker collapsed until expanded', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.queryByText('Focus on the providers step only.')).toBeNull();
    expect(screen.queryByText('Complete ONLY this workflow step.')).toBeNull();
  });

  it('reveals instructions and marker once expanded', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expand();
    expect(screen.getByText('Focus on the providers step only.')).toBeDefined();
    expect(screen.getByText('Complete ONLY this workflow step.')).toBeDefined();
    expect(screen.getByText(/what to do/i)).toBeDefined();
    expect(screen.getByText(/marker to emit/i)).toBeDefined();
  });

  it('can collapse again after expanding', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expand();
    expect(screen.getByText('Focus on the providers step only.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByText('Focus on the providers step only.')).toBeNull();
  });

  it('falls back to raw text when not parsed', () => {
    const raw = { ...parsedItem, parsed: false } as Extract<
      TranscriptItem,
      { kind: 'workflow_kickoff' }
    >;
    render(<WorkflowKickoffCard item={raw} />);
    expect(screen.queryByText('raw kickoff text')).toBeNull();
    expand();
    expect(screen.getByText('raw kickoff text')).toBeDefined();
  });

  it('shows the workflow start header in both parsed and unparsed states', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.getByText(/workflow start/i)).toBeDefined();
    cleanup();
    const raw = { ...parsedItem, parsed: false } as Extract<
      TranscriptItem,
      { kind: 'workflow_kickoff' }
    >;
    render(<WorkflowKickoffCard item={raw} />);
    expect(screen.getByText(/workflow start/i)).toBeDefined();
  });

  it('omits "what to do" section when instructions are empty', () => {
    const noInstructions = { ...parsedItem, instructions: '' } as Extract<
      TranscriptItem,
      { kind: 'workflow_kickoff' }
    >;
    render(<WorkflowKickoffCard item={noInstructions} />);
    expand();
    expect(screen.queryByText(/what to do/i)).toBeNull();
  });

  it('omits "marker to emit" section when marker is empty', () => {
    const noMarker = { ...parsedItem, marker: '' } as Extract<
      TranscriptItem,
      { kind: 'workflow_kickoff' }
    >;
    render(<WorkflowKickoffCard item={noMarker} />);
    expand();
    expect(screen.queryByText(/marker to emit/i)).toBeNull();
  });

  it('renders the timestamp', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeDefined();
  });
});
