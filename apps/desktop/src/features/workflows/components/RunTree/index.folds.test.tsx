// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  Agent,
  MeasuredTurnSpan,
  OpenQuestion,
  ProviderRunId,
  TelemetryRecord,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import { RunTreeHarness } from './testing/RunTreeHarness';
import {
  SESSION_ID,
  WORKSPACE_ID,
  baseAgents,
  child,
  question,
  scouts,
  workflow,
} from './testing/runTreeFixtures';

const seed = ({
  agents,
  questions = [],
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
}) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...agents] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionOpenQuestions: { [SESSION_ID]: [...questions] },
  });
};

const spanOf = ({
  agentId,
  startedAtMs,
  endedAtMs,
}: {
  readonly agentId: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
}): MeasuredTurnSpan => ({
  agentId: agentId as MeasuredTurnSpan['agentId'],
  parentAgentId: null,
  agentStatus: null,
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'scout',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  startedAtMs,
  endedAtMs,
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
});

const ROW = /^run-tree-(row-|fold-row)/u;

const orderOf = (): ReadonlyArray<string> =>
  screen.getAllByTestId(ROW).map((row) => row.dataset.testid?.replace('run-tree-row-', '') ?? '');

const foldButton = (): HTMLElement =>
  within(screen.getByTestId('run-tree-fold-row')).getByRole('button');

beforeEach(() => {
  useAppStore.setState({
    sessionTelemetry: {},
    agentRunHistory: {},
    sessionWorkflows: {},
    sessionPlans: {},
    orchestratingWorkflowRuns: {},
    agentTurnState: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SCOUT_KINDS = {
  'scout-a': 'scout',
  'scout-b': 'scout',
  'scout-c': 'scout',
} as const;

describe('RunTree sub-agent sets', () => {
  it('opens a set that settled before the page opened folded, under its parent', () => {
    seed({ agents: [...baseAgents, ...scouts()] });
    render(<RunTreeHarness kinds={SCOUT_KINDS} />);

    expect(orderOf()).toEqual(['scout', 'implement', 'run-tree-fold-row', 'review']);
    expect(foldButton().getAttribute('aria-label')).toBe('3 scouts · done, expand');
    expect(foldButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the set downward under the fold row, oldest first, and folds it again', async () => {
    const user = userEvent.setup();
    seed({ agents: [...baseAgents, ...scouts()] });
    render(<RunTreeHarness kinds={SCOUT_KINDS} />);

    await user.click(foldButton());

    expect(orderOf()).toEqual([
      'scout',
      'implement',
      'run-tree-fold-row',
      'scout-a',
      'scout-b',
      'scout-c',
      'review',
    ]);
    expect(foldButton().getAttribute('aria-expanded')).toBe('true');
    expect(foldButton().getAttribute('aria-label')).toBe('3 scouts · done, fold');

    await user.click(foldButton());

    expect(orderOf()).toEqual(['scout', 'implement', 'run-tree-fold-row', 'review']);
  });

  it('opens and folds from the keyboard on the fold row button', async () => {
    const user = userEvent.setup();
    seed({ agents: [...baseAgents, ...scouts()] });
    render(<RunTreeHarness />);

    foldButton().focus();
    await user.keyboard('{Enter}');
    expect(foldButton().getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{ArrowLeft}');
    expect(foldButton().getAttribute('aria-expanded')).toBe('false');

    await user.keyboard('{ArrowRight}');
    expect(foldButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps a set open that settles while the page is open, until the user folds it', async () => {
    const user = userEvent.setup();
    seed({ agents: [...baseAgents, ...scouts('running')] });
    render(<RunTreeHarness />);

    expect(screen.queryByTestId('run-tree-fold-row')).toBeNull();
    expect(orderOf()).toContain('scout-a');

    act(() => seed({ agents: [...baseAgents, ...scouts()] }));

    expect(orderOf()).toEqual([
      'scout',
      'implement',
      'run-tree-fold-row',
      'scout-a',
      'scout-b',
      'scout-c',
      'review',
    ]);
    expect(foldButton().getAttribute('aria-expanded')).toBe('true');

    await user.click(foldButton());

    expect(orderOf()).toEqual(['scout', 'implement', 'run-tree-fold-row', 'review']);
  });

  it('opens a folded set again when a child appears, and keeps it open once that child settles', () => {
    seed({ agents: [...baseAgents, ...scouts()] });
    render(<RunTreeHarness />);
    const running = child({ id: 'scout-d', minute: 15, status: 'running' });

    act(() => seed({ agents: [...baseAgents, ...scouts(), running] }));

    expect(orderOf()).toEqual([
      'scout',
      'implement',
      'scout-a',
      'scout-b',
      'scout-c',
      'scout-d',
      'review',
    ]);

    act(() => seed({ agents: [...baseAgents, ...scouts(), child({ id: 'scout-d', minute: 15 })] }));

    expect(foldButton().getAttribute('aria-expanded')).toBe('true');
    expect(orderOf()).toContain('scout-d');
  });

  it('keeps a set open while one of its children asks you something', () => {
    seed({
      agents: [...baseAgents, ...scouts()],
      questions: [question({ agentId: 'scout-b' })],
    });
    render(<RunTreeHarness />);

    expect(screen.queryByTestId('run-tree-fold-row')).toBeNull();
    expect(orderOf()).toContain('scout-b');
  });

  it('says how long the set worked and what it cost, next to what it holds', () => {
    const runIds = { 'scout-a': 'run-a', 'scout-b': 'run-b', 'scout-c': 'run-c' } as const;
    useAppStore.setState({
      agentRunHistory: Object.fromEntries(
        Object.entries(runIds).map(([agentId, runId]) => [agentId, [runId as ProviderRunId]]),
      ),
      sessionTelemetry: {
        [SESSION_ID]: Object.values(runIds).map(
          (runId, index) =>
            ({
              id: `rec-${index}`,
              runId: runId as ProviderRunId,
              sessionId: SESSION_ID,
              kind: 'turn',
              provider: 'gemini',
              model: 'gemini-3-pro',
              inputTokens: 10,
              outputTokens: 2,
              estimatedCostUsd: 0.03,
              recordedAt: '2026-08-18T09:20:00.000Z',
            }) as TelemetryRecord,
        ),
      },
    });
    const minute = 60_000;
    const source: WorkTimeSource = {
      nowMs: 10 * minute,
      spans: Object.keys(runIds).map((agentId, index) =>
        spanOf({ agentId, startedAtMs: index * minute, endedAtMs: (index + 1) * minute }),
      ),
      history: null,
      liveStartMs: new Map(),
      childrenOf: new Map(),
    };
    seed({ agents: [...baseAgents, ...scouts()] });
    render(<RunTreeHarness kinds={SCOUT_KINDS} source={source} />);

    expect(foldButton().getAttribute('aria-label')).toBe('3 scouts · done · 3m · $0.09, expand');
  });

  it('reveals the live row only, never a row of a folded set', () => {
    const reveal = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);
    seed({ agents: [...baseAgents, ...scouts()] });
    render(<RunTreeHarness />);

    const revealed = reveal.mock.contexts.map((element) => element as HTMLElement);

    expect(reveal).toHaveBeenCalledWith({ block: 'nearest' });
    expect(
      revealed.map((element) =>
        element.querySelector('[data-testid^="run-tree-row-"]')?.getAttribute('data-testid'),
      ),
    ).toEqual(['run-tree-row-implement']);
  });
});
