// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  AgentHandoff,
  AgentId,
  IsoDateTime,
  PlanId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { useAppStore } from '../../../../store';

import { HandoffBlock } from '.';
import { requestHandoffOpen } from './handoffOpenRequest';

const SESSION = 'session-1' as SessionId;
const AGENT = 'agent-4' as AgentId;
const AT = '2026-09-25T12:04:00.000Z' as IsoDateTime;
const loadAgentHandoff = vi.fn(async () => undefined);
const navigate = vi.fn();

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
  beforeAll(async () => {
    await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
    loadAgentHandoff.mockClear();
    navigate.mockClear();
    useAppStore.setState({
      agentHandoffs: { [AGENT]: handoff() },
      transcripts: {
        [AGENT]: [{ kind: 'assistant_text', runId: 'r' as never, delta: 'On it.', at: AT }],
      },
      loadAgentHandoff,
      navigate,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows who sent the agent, the ask and the why, closed, without chips', () => {
    renderBlock();

    screen.getByText('Orchestrator · step 4');
    screen.getByText('Backfill the settled batches behind a flag.');
    screen.getByText('Why: Rounding now lands once per batch.');
    expect(screen.queryByTestId('handoff-chips')).toBeNull();
    expect(screen.queryByTestId('handoff-section-ask')).toBeNull();
  });

  it('shows one chip per section once the block opens', () => {
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));

    expect(screen.getByTestId('handoff-chips').textContent).toBe(
      'Ask1 earlier stepPlanImplementer instructionsAll',
    );
  });

  it('a second click on the same chip closes its section', () => {
    renderBlock();
    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));
    const planChip = screen.getByRole('button', { name: 'Plan' });

    fireEvent.click(planChip);
    screen.getByTestId('handoff-section-plan');
    expect(planChip.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(planChip);
    expect(screen.queryByTestId('handoff-section-plan')).toBeNull();
    expect(planChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('hides the chips again when the block closes', () => {
    renderBlock();
    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));
    screen.getByTestId('handoff-chips');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse what the agent received' }));

    expect(screen.queryByTestId('handoff-chips')).toBeNull();
  });

  it('keeps only one section open: a second chip replaces the first', () => {
    renderBlock();
    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    screen.getByTestId('handoff-section-plan');

    fireEvent.click(screen.getByRole('button', { name: 'Implementer instructions' }));
    expect(screen.queryByTestId('handoff-section-plan')).toBeNull();
    screen.getByTestId('handoff-section-role');
  });

  it('opens the Ask section when the Brief requests the handoff', () => {
    requestHandoffOpen({ agentId: AGENT });
    renderBlock();

    screen.getByTestId('handoff-section-ask');
    expect(screen.getByRole('button', { name: 'Ask' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('handoff-section-plan')).toBeNull();
  });

  it('Escape closes the open section and returns focus to its chip', () => {
    renderBlock();
    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));
    const planChip = screen.getByRole('button', { name: 'Plan' });
    fireEvent.click(planChip);

    fireEvent.keyDown(screen.getByTestId('handoff-section-plan'), { key: 'Escape' });

    expect(screen.queryByTestId('handoff-section-plan')).toBeNull();
    expect(document.activeElement).toBe(planChip);
  });

  it('Escape in one card returns focus to its own chip, not another cards chip of the same kind', () => {
    const otherAgent = 'agent-5' as AgentId;
    useAppStore.setState({
      agentHandoffs: { [AGENT]: handoff(), [otherAgent]: handoff() },
    });
    render(
      <>
        <HandoffBlock item={item()} sessionId={SESSION} agentId={AGENT} workingDir={null} />
        <HandoffBlock
          item={item({ key: 'handoff-1', handoffId: otherAgent })}
          sessionId={SESSION}
          agentId={otherAgent}
          workingDir={null}
        />
      </>,
    );
    screen
      .getAllByRole('button', { name: 'Expand what the agent received' })
      .forEach((button) => fireEvent.click(button));
    const planChips = screen.getAllByRole('button', { name: 'Plan' });
    fireEvent.click(planChips[1]!);

    fireEvent.keyDown(screen.getByTestId('handoff-section-plan'), { key: 'Escape' });

    expect(document.activeElement).toBe(planChips[1]);
    expect(document.activeElement).not.toBe(planChips[0]);
  });

  it('All shows every section together', () => {
    renderBlock();
    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    expect(screen.queryByTestId('handoff-section-role')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    screen.getByTestId('handoff-section-ask');
    screen.getByTestId('handoff-section-plan');
    screen.getByTestId('handoff-section-role');
    expect(
      screen
        .getAllByTestId(/^handoff-section-/)
        .every((row) => row.querySelector('button')?.getAttribute('aria-expanded') === 'false'),
    ).toBe(true);
  });

  it('stays closed before the agent answers and keeps machine markers out of the DOM', () => {
    useAppStore.setState({
      transcripts: { [AGENT]: [] },
      agentHandoffs: {
        [AGENT]: handoff({
          sections: [
            {
              kind: 'ask',
              summary: 'Backfill the settled batches behind a flag.',
              bodyMd: 'Reply contract\n<<comment-resolved threadId="thread-1">>',
              refs: [],
            },
          ],
        }),
      },
    });
    renderBlock();

    expect(screen.queryByTestId('handoff-section-ask')).toBeNull();
    expect(screen.queryByTestId('handoff-chips')).toBeNull();
    expect(screen.queryByText(/comment-resolved/)).toBeNull();
  });

  it('splits what the human wrote from the rules Goodboy added for a re-check', () => {
    useAppStore.setState({
      agentHandoffs: {
        [AGENT]: handoff({
          sender: { kind: 'recheck', threadIds: ['thread-1'], prNumber: 412 },
          ask: 'Check whether the retry cap is still on this branch.',
          sections: [
            {
              kind: 'ask',
              summary: 'Check whether the retry cap is still on this branch.',
              bodyMd: 'Check whether the retry cap is still on this branch.',
              refs: [],
            },
            {
              kind: 'instructions',
              summary: 'Added by Goodboy',
              bodyMd: 'Reply contract: end with the resolved marker.',
              refs: [],
            },
          ],
          sentMessage:
            'Check whether the retry cap is still on this branch.\n\nReply contract: end with the resolved marker.',
        }),
      },
    });
    renderBlock();

    screen.getByText('Re-check · 1 comment on #412');
    screen.getByText('Check whether the retry cap is still on this branch.');
    expect(screen.queryByText(/Reply contract/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));
    expect(screen.getByTestId('handoff-chips').textContent).toBe('AskInstructionsAll');

    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }));
    expect(screen.getByTestId('handoff-section-instructions').textContent).toContain(
      'Reply contract: end with the resolved marker.',
    );
  });

  it('names the scribe and the history rewrite as their own senders', () => {
    useAppStore.setState({
      agentHandoffs: { [AGENT]: handoff({ sender: { kind: 'scribe' } }) },
    });
    const first = renderBlock();
    screen.getByText('Scribe');
    first.unmount();

    useAppStore.setState({
      agentHandoffs: { [AGENT]: handoff({ sender: { kind: 'historyRewrite' } }) },
    });
    renderBlock();
    screen.getByText('History rewrite');
  });

  it('opens the block on the section a chip names, and an earlier step opens that agent', () => {
    renderBlock();
    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));

    fireEvent.click(screen.getByRole('button', { name: '1 earlier step' }));
    fireEvent.click(screen.getByRole('button', { name: /Trace the rounding/ }));

    expect(navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION, agentId: 'agent-2' },
    });
  });

  it('shows the plan as a title and a link, never its body', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-plan-studio', listener);
    renderBlock();
    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open plan' }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:open-plan-studio', listener);
  });

  it('shows the text as sent, in two parts for Claude', () => {
    useAppStore.setState({ transcripts: { [AGENT]: [] } });
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByRole('button', { name: 'View as sent to Claude' }));

    screen.getByText(/System prompt/);
    screen.getByText(/Message · /);
    expect(screen.queryByText(/no separate system prompt/)).toBeNull();
  });

  it('says why other providers get one part', () => {
    useAppStore.setState({
      transcripts: { [AGENT]: [] },
      agentHandoffs: { [AGENT]: handoff({ provider: 'codex', sentSystem: null }) },
    });
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Expand what the agent received' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByRole('button', { name: 'View as sent to Codex' }));

    screen.getByText(
      'Codex has no separate system prompt, so scope, profile and role come first in the message.',
    );
    expect(screen.queryByText(/System prompt ·/)).toBeNull();
  });

  it('keeps your own first message as your bubble, with what else the agent received', () => {
    useAppStore.setState({
      agentHandoffs: {
        [AGENT]: handoff({
          sender: { kind: 'you' },
          ask: 'Which services read the per-line totals?',
          sections: [
            {
              kind: 'ask',
              summary: 'Which services read the per-line totals?',
              bodyMd: 'Which services read the per-line totals?\n\nCheck payments-api too.',
              refs: [],
            },
            ...handoff().sections.slice(1),
          ],
        }),
      },
    });
    renderBlock({ text: 'Which services read the per-line totals?' });

    screen.getByText('Which services read the per-line totals?');
    screen.getByText('Check payments-api too.');
    expect(screen.getByTestId('handoff-also-received').textContent).toContain('Also received');
    expect(screen.getByTestId('handoff-chips').textContent).toBe(
      '1 earlier stepPlanImplementer instructionsAll',
    );
  });

  it('keeps an attached plan out of your visible message', () => {
    useAppStore.setState({
      agentHandoffs: {
        [AGENT]: handoff({
          sender: { kind: 'you' },
          ask: 'Implement the approved retry change.',
          sections: [
            {
              kind: 'ask',
              summary: 'Implement the approved retry change.',
              bodyMd: 'Implement the approved retry change.',
              refs: [],
            },
            {
              kind: 'plan',
              summary: 'Bound retry attempts',
              bodyMd: '',
              refs: [{ kind: 'plan', planId: 'plan-1' as PlanId, label: 'Bound retry attempts' }],
            },
          ],
        }),
      },
    });
    renderBlock({
      text: '**Plan**\n1. Add the cap.\n2. Add jitter.\n\nImplement the approved retry change.',
    });

    screen.getByText('Implement the approved retry change.');
    expect(screen.queryByText('1. Add the cap.')).toBeNull();
    screen.getByRole('button', { name: 'Plan' });
  });

  it('shows an agent spawned before handoffs were stored in the older format', () => {
    renderBlock({ handoffId: null });

    const row = screen.getByTestId('handoff-older-format');
    expect(row.textContent).toContain('First message');
    expect(row.textContent).toContain('Older format');
    expect(loadAgentHandoff).not.toHaveBeenCalled();
  });

  it('loads a handoff it has not read yet', () => {
    useAppStore.setState({ agentHandoffs: {} });
    renderBlock();

    expect(loadAgentHandoff).toHaveBeenCalledWith({ agentId: AGENT });
  });
});
