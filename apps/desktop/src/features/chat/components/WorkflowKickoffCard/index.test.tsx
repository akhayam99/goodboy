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

describe('WorkflowKickoffCard', () => {
  it('shows the instructions expanded by default', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.getByText('Focus on the providers step only.')).toBeDefined();
  });

  it('keeps the goal collapsed until expanded', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.queryByText('Ship the onboarding wizard')).toBeNull();
    fireEvent.click(screen.getByText(/^goal$/i));
    expect(screen.getByText('Ship the onboarding wizard')).toBeDefined();
  });

  it('keeps the marker collapsed until expanded', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.queryByText('Complete ONLY this workflow step.')).toBeNull();
    fireEvent.click(screen.getByText(/marker to emit/i));
    expect(screen.getByText('Complete ONLY this workflow step.')).toBeDefined();
  });

  it('falls back to raw text when not parsed', () => {
    const raw = { ...parsedItem, parsed: false } as Extract<
      TranscriptItem,
      { kind: 'workflow_kickoff' }
    >;
    render(<WorkflowKickoffCard item={raw} />);
    expect(screen.getByText('raw kickoff text')).toBeDefined();
  });

  it('shows workflow start header in both parsed and unparsed states', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.getByText(/workflow start/i)).toBeDefined();
  });

  it('shows workflow start header when not parsed', () => {
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
    expect(screen.queryByText(/what to do/i)).toBeNull();
  });

  it('omits "marker to emit" collapsible when marker is empty', () => {
    const noMarker = { ...parsedItem, marker: '' } as Extract<
      TranscriptItem,
      { kind: 'workflow_kickoff' }
    >;
    render(<WorkflowKickoffCard item={noMarker} />);
    expect(screen.queryByText(/marker to emit/i)).toBeNull();
  });

  it('can collapse the goal again after expanding it', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    const trigger = screen.getByText(/^goal$/i);
    fireEvent.click(trigger);
    expect(screen.getByText('Ship the onboarding wizard')).toBeDefined();
    fireEvent.click(trigger);
    expect(screen.queryByText('Ship the onboarding wizard')).toBeNull();
  });

  it('can collapse the marker again after expanding it', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    const trigger = screen.getByText(/marker to emit/i);
    fireEvent.click(trigger);
    expect(screen.getByText('Complete ONLY this workflow step.')).toBeDefined();
    fireEvent.click(trigger);
    expect(screen.queryByText('Complete ONLY this workflow step.')).toBeNull();
  });

  it('renders the timestamp', () => {
    render(<WorkflowKickoffCard item={parsedItem} />);
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeDefined();
  });
});
