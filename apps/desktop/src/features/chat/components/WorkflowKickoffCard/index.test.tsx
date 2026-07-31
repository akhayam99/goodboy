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

const itemWith = (patch: Partial<Extract<TranscriptItem, { kind: 'workflow_kickoff' }>>) =>
  ({ ...parsedItem, ...patch }) as Extract<TranscriptItem, { kind: 'workflow_kickoff' }>;

const expand = () => fireEvent.click(screen.getByRole('button', { expanded: false }));

describe('WorkflowKickoffCard', () => {
  it('shows the goal as a truncated preview on the header row while collapsed', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);

    const preview = screen.getByText('Ship the onboarding wizard');
    expect(preview.className).toContain('truncate');
    expect(screen.queryByText('goal')).toBeNull();
  });

  it('reveals the full goal, then the instructions, then the marker once expanded', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expand();

    const labels = screen
      .getAllByText(/^(goal|what to do|marker to emit)$/)
      .map((el) => el.textContent);
    expect(labels).toEqual(['goal', 'what to do', 'marker to emit']);
    const fullGoal = screen
      .getAllByText('Ship the onboarding wizard')
      .filter((el) => !el.className.includes('truncate'));
    expect(fullGoal.length).toBe(1);
    expect(screen.getByText('Focus on the providers step only.')).toBeDefined();
    expect(screen.getByText('Complete ONLY this workflow step.')).toBeDefined();
  });

  it('can collapse the goal again after expanding', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expand();
    expect(screen.getByText('goal')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { expanded: true }));

    expect(screen.queryByText('goal')).toBeNull();
    expect(screen.queryByText('Focus on the providers step only.')).toBeNull();
  });

  it('offers the toggle when the goal is the only detail', () => {
    render(<WorkflowKickoffCard item={itemWith({ instructions: '', marker: '' })} />);

    expand();

    expect(screen.getByText('goal')).toBeDefined();
  });

  it('falls back to raw text when not parsed', () => {
    render(<WorkflowKickoffCard item={itemWith({ parsed: false })} />);

    expect(screen.queryByText('raw kickoff text')).toBeNull();
    expand();
    expect(screen.getByText('raw kickoff text')).toBeDefined();
  });

  it('shows the workflow start header in both parsed and unparsed states', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.getByText(/workflow start/i)).toBeDefined();
    cleanup();

    render(<WorkflowKickoffCard item={itemWith({ parsed: false })} />);
    expect(screen.getByText(/workflow start/i)).toBeDefined();
  });

  it('omits "what to do" section when instructions are empty', () => {
    render(<WorkflowKickoffCard item={itemWith({ instructions: '' })} />);
    expand();

    expect(screen.queryByText('what to do')).toBeNull();
  });

  it('omits "marker to emit" section when marker is empty', () => {
    render(<WorkflowKickoffCard item={itemWith({ marker: '' })} />);
    expand();

    expect(screen.queryByText('marker to emit')).toBeNull();
  });

  it('renders the timestamp', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);

    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeDefined();
  });
});
