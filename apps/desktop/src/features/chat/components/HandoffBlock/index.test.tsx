// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentHandoff,
  AgentId,
  IsoDateTime,
  PlanId,
  SessionId,
  TurnEvent,
  WorkflowRunId,
} from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';

const state = vi.hoisted(() => ({
  agentHandoffs: {} as Record<string, AgentHandoff | null>,
  transcripts: {} as Record<string, ReadonlyArray<TurnEvent>>,
  sessionPhaseRuns: {} as Record<string, ReadonlyArray<Agent>>,
  sessionOpenQuestions: {} as Record<string, ReadonlyArray<unknown>>,
  sessionAnsweredQuestions: {} as Record<string, ReadonlyArray<unknown>>,
  loadAgentHandoff: vi.fn(async () => undefined),
  selectAgent: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
}));

import { HandoffBlock } from '.';

const SESSION = 'session-1' as SessionId;
const AGENT = 'agent-4' as AgentId;
const AT = '2026-09-25T12:04:00.000Z' as IsoDateTime;

const handoff = (overrides: Partial<AgentHandoff> = {}): AgentHandoff => ({
  agentId: AGENT,
  sender: { kind: 'orchestrator', workflowRunId: 'run-1' as WorkflowRunId, stepOrdinal: 4 },
  ask: 'Backfill the settled batches behind a flag.',
  why: 'Rounding now lands once per batch.',
  doneWhen: 'A dry run report lists every batch.',
  sections: [
    {
      kind: 'ask',
      summary: 'Backfill the settled batches behind a flag.',
      bodyMd: 'Backfill the settled batches behind a flag.',
      refs: [],
    },
    {
      kind: 'earlierSteps',
      summary: '1 step passed its result to this one',
      bodyMd: '',
      refs: [
        {
          kind: 'agent',
          agentId: 'agent-2' as AgentId,
          ordinal: 2,
          label: 'Trace the rounding',
          detail: 'Every posting rounds itself.',
        },
      ],
    },
    {
      kind: 'plan',
      summary: 'Round once per batch',
      bodyMd: '',
      refs: [{ kind: 'plan', planId: 'plan-1' as PlanId, label: 'Round once per batch' }],
    },
    {
      kind: 'role',
      summary: 'Implementer · built in',
      bodyMd: 'you are an implementation agent.',
      refs: [],
    },
  ],
  sentSystem: '[projects-scope]\nWrites ledger-core.\n[/projects-scope]',
  sentMessage: 'Backfill the settled batches behind a flag.',
  provider: 'anthropic',
  createdAt: AT,
  ...overrides,
});

const item = (
  overrides: Partial<Extract<TranscriptItem, { kind: 'handoff' }>> = {},
): Extract<TranscriptItem, { kind: 'handoff' }> => ({
  kind: 'handoff',
  key: 'handoff-0',
  handoffId: AGENT,
  text: '**Goal** settle\n\nBackfill the settled batches behind a flag.',
  at: AT,
  ...overrides,
});

const renderBlock = (overrides: Partial<Extract<TranscriptItem, { kind: 'handoff' }>> = {}) =>
  render(
    <HandoffBlock item={item(overrides)} sessionId={SESSION} agentId={AGENT} workingDir={null} />,
  );

describe('HandoffBlock', () => {
  beforeEach(() => {
    state.agentHandoffs = { [AGENT]: handoff() };
    state.transcripts = {
      [AGENT]: [{ kind: 'assistant_text', runId: 'r' as never, delta: 'On it.', at: AT }],
    };
    state.loadAgentHandoff.mockClear();
    state.selectAgent.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows who sent the agent, the ask, the why and one chip per section, closed', () => {
    renderBlock();

    expect(screen.getByText('Orchestrator · step 4')).toBeTruthy();
    expect(screen.getByText('Backfill the settled batches behind a flag.')).toBeTruthy();
    expect(screen.getByText('Why: Rounding now lands once per batch.')).toBeTruthy();
    expect(screen.getByTestId('handoff-chips').textContent).toBe(
      'Ask1 earlier stepPlanImplementer instructionsAll',
    );
    expect(screen.queryByTestId('handoff-section-ask')).toBeNull();
  });

  it('keeps the chips visible once the block is open', () => {
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));

    expect(screen.getByTestId('handoff-chips').textContent).toBe(
      'Ask1 earlier stepPlanImplementer instructionsAll',
    );
  });

  it('a second click on the same chip closes its section', () => {
    renderBlock();
    const planChip = screen.getByRole('button', { name: 'Plan' });

    fireEvent.click(planChip);
    expect(screen.getByTestId('handoff-section-plan')).toBeTruthy();
    expect(planChip.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(planChip);
    expect(screen.queryByTestId('handoff-section-plan')).toBeNull();
    expect(planChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps only one section open: a second chip replaces the first', () => {
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    expect(screen.getByTestId('handoff-section-plan')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Implementer instructions' }));
    expect(screen.queryByTestId('handoff-section-plan')).toBeNull();
    expect(screen.getByTestId('handoff-section-role')).toBeTruthy();
  });

  it('Escape closes the open section and returns focus to its chip', () => {
    renderBlock();
    const planChip = screen.getByRole('button', { name: 'Plan' });
    fireEvent.click(planChip);

    fireEvent.keyDown(screen.getByTestId('handoff-section-plan'), { key: 'Escape' });

    expect(screen.queryByTestId('handoff-section-plan')).toBeNull();
    expect(document.activeElement).toBe(planChip);
  });

  it('All shows every section together', () => {
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByTestId('handoff-section-ask')).toBeTruthy();
    expect(screen.getByTestId('handoff-section-plan')).toBeTruthy();
    expect(screen.getByTestId('handoff-section-role')).toBeTruthy();
  });

  it('opens by itself while the agent has not answered yet', () => {
    state.transcripts = { [AGENT]: [] };
    renderBlock();

    expect(screen.getByTestId('handoff-section-ask')).toBeTruthy();
  });

  it('opens the block on the section a chip names, and an earlier step opens that agent', () => {
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: '1 earlier step' }));
    fireEvent.click(screen.getByRole('button', { name: /Trace the rounding/ }));

    expect(state.selectAgent).toHaveBeenCalledWith(SESSION, 'agent-2');
  });

  it('shows the plan as a title and a link, never its body', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-plan-studio', listener);
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open plan' }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:open-plan-studio', listener);
  });

  it('shows the text as sent, in two parts for Claude', () => {
    state.transcripts = { [AGENT]: [] };
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'View as sent to Claude' }));

    expect(screen.getByText(/System prompt/)).toBeTruthy();
    expect(screen.getByText(/Message · /)).toBeTruthy();
    expect(screen.queryByText(/no separate system prompt/)).toBeNull();
  });

  it('says why other providers get one part', () => {
    state.transcripts = { [AGENT]: [] };
    state.agentHandoffs = { [AGENT]: handoff({ provider: 'codex', sentSystem: null }) };
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'View as sent to Codex' }));

    expect(
      screen.getByText(
        'Codex has no separate system prompt, so scope, profile and role come first in the message.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/System prompt ·/)).toBeNull();
  });

  it('keeps your own first message as your bubble, with what else the agent received', () => {
    state.agentHandoffs = { [AGENT]: handoff({ sender: { kind: 'you' } }) };
    renderBlock({ text: 'Which services read the per-line totals?' });

    expect(screen.getByText('Which services read the per-line totals?')).toBeTruthy();
    expect(screen.getByTestId('handoff-also-received').textContent).toContain('Also received');
    expect(screen.getByTestId('handoff-chips').textContent).toBe(
      '1 earlier stepPlanImplementer instructionsAll',
    );
  });

  it('shows an agent spawned before handoffs were stored in the older format', () => {
    renderBlock({ handoffId: null });

    expect(screen.getByTestId('handoff-older-format').textContent).toContain('older format');
    expect(state.loadAgentHandoff).not.toHaveBeenCalled();
  });

  it('loads a handoff it has not read yet', () => {
    state.agentHandoffs = {};
    renderBlock();

    expect(state.loadAgentHandoff).toHaveBeenCalledWith({ agentId: AGENT });
  });
});
