// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type Agent, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { aView, FIXTURE_ROOT, FIXTURE_SESSION } from '../../../auto/testing/autoViewFixtures';
import { AGENT_KIND_ORDER, type AgentKind } from '../../agent-kind';
import { latestDoneOf } from '../cards/latestDoneOf';
import { outcomeLineOf, type OutcomeLine } from './outcomeLineOf';
import { at, eventOf, modelOf, sourceOf, stepAgent, workflowOf } from './testing/doneFixtures';

type Row = {
  readonly name: string;
  readonly line: OutcomeLine;
};

const done = (overrides: Parameters<typeof anAgent>[0] = {}): Agent =>
  anAgent({
    sessionId: FIXTURE_SESSION,
    status: 'completed',
    startedAt: at({ hour: 9 }),
    completedAt: at({ hour: 9, minute: 20 }),
    ...overrides,
  });

const agentRowOf = ({ kind }: { readonly kind: AgentKind }): Row => {
  const agent = done({
    id: brandId<AgentId>({ value: `agent-${kind}` }),
    kind,
    outputSummary: `cluster 1/2 green: typecheck/lint/knip/vitest ok in apps/desktop/src/features/${kind}/central/done/file.ts, nothing to commit`,
  });
  const model = modelOf({ agents: [agent] });
  return {
    name: `agent ${kind}`,
    line: outcomeLineOf({ entry: sourceOf({ model, id: `agent:${agent.id}` }), model }),
  };
};

const autoRowOf = ({ rootAsk }: { readonly rootAsk: string | null }): Row => {
  const root = done({
    id: FIXTURE_ROOT,
    kind: 'auto',
    name: 'Keep the payments-api retries green',
  });
  const children = ['a', 'b', 'c'].map((key) =>
    done({
      id: brandId<AgentId>({ value: `agent-auto-child-${key}` }),
      kind: 'implementer',
      parentAgentId: FIXTURE_ROOT,
    }),
  );
  const model = modelOf({
    agents: [root, ...children],
    autoTrees: [aView({ phase: 'done', rootAsk })],
  });
  return {
    name: rootAsk === null ? 'auto, nothing waiting' : 'auto, waiting on you',
    line: outcomeLineOf({ entry: sourceOf({ model, id: `agent:${FIXTURE_ROOT}` }), model }),
  };
};

const runRowOf = ({
  name,
  total,
  isOrchestrated,
  finished,
  isSlice,
}: {
  readonly name: string;
  readonly total: number;
  readonly isOrchestrated: boolean;
  readonly finished: ReadonlyArray<number>;
  readonly isSlice: boolean;
}): Row => {
  const steps = finished.map((index) =>
    stepAgent({ index, summary: `Result of step ${index}. Details.` }),
  );
  const model = modelOf({ agents: steps, runs: [workflowOf({ total, isOrchestrated })] });
  const entry = sourceOf({ model, id: 'run:run-build' });
  const slice =
    entry.kind === 'run' ? entry.children.flatMap((c) => (c.kind === 'agent' ? [c] : [])) : [];
  return { name, line: outcomeLineOf({ entry, model, ...(isSlice ? { slice } : {}) }) };
};

const rebaseRow = (): Row => {
  const model = modelOf({
    events: [
      eventOf({
        id: 'done',
        kind: 'history_rewritten',
        payload: { origin: 'rebase', branch: 'hl/fix' },
        createdAt: at({ hour: 9, minute: 12 }),
      }),
    ],
  });
  return {
    name: 'rebase event',
    line: outcomeLineOf({ entry: sourceOf({ model, id: 'event:done' }), model }),
  };
};

const unlistedRow = (): Row => {
  const agent = done({ kind: 'tester', outputSummary: 'cluster 1/2 verde: tests ok, no commit' });
  const { unreadItems } = latestDoneOf({
    days: [],
    unreadAgents: [{ ...agent, lastFinishedAt: at({ hour: 9 }) }],
  });
  const [item] = unreadItems;
  if (item === undefined) {
    throw new Error('no unread item');
  }
  return {
    name: 'unlisted unread agent',
    line: {
      title: item.row.title,
      by: item.row.by,
      kind: item.row.kind,
      leadAgentId: item.row.leadAgentId,
    },
  };
};

const ROWS: ReadonlyArray<Row> = [
  ...AGENT_KIND_ORDER.map((kind) => agentRowOf({ kind })),
  autoRowOf({ rootAsk: null }),
  autoRowOf({ rootAsk: 'Cap per day or per payout?' }),
  runRowOf({
    name: 'finished static run',
    total: 5,
    isOrchestrated: false,
    finished: [1, 2, 3, 4, 5],
    isSlice: false,
  }),
  runRowOf({
    name: 'finished orchestrated run',
    total: 26,
    isOrchestrated: true,
    finished: Array.from({ length: 26 }, (_, index) => index + 1),
    isSlice: false,
  }),
  runRowOf({
    name: 'live run slice with gaps',
    total: 26,
    isOrchestrated: false,
    finished: [1, 2, 3, 4, 6, 7, 9],
    isSlice: true,
  }),
  rebaseRow(),
  unlistedRow(),
];

describe('the copy of every row kind', () => {
  it.each(ROWS.map((row) => [row.name, row] as const))('%s reads like a person', (_name, row) => {
    expect(row.line.title.length).toBeGreaterThan(0);
    expect(row.line.title.length).toBeLessThanOrEqual(91);
    expect(row.line.title).not.toMatch(/\w\/\w+\/\w/);
    expect(row.line.title).not.toMatch(/^[a-z]/);
    expect(row.line.title).not.toMatch(/\b[0-9a-f]{7,40}\b/);
    expect(row.line.by).not.toBe('Agent');
    expect(row.line.by).not.toMatch(/\d+, \d+/);
    expect(row.line.by).not.toMatch(/\d+ and \d+, /);
    expect(row.line.by).not.toMatch(/answered|decision|withdrawn|replaced/);
    expect(row.line.by).not.toMatch(/ · $/);
  });

  it('names the role of every agent kind and never the bare word Agent', () => {
    for (const kind of AGENT_KIND_ORDER) {
      const { line } = agentRowOf({ kind });

      expect(line.by, kind).not.toBe('Agent');
      expect(line.kind, kind).toBe(kind);
    }
  });

  it('puts kind, agent count, steps progress and what needs you on a run', () => {
    const byOf = ({ name }: { readonly name: string }): string =>
      ROWS.find((row) => row.name === name)?.line.by ?? '';

    expect(byOf({ name: 'finished static run' })).toBe('Build · 5 agents · 5 of 5 steps');
    expect(byOf({ name: 'finished orchestrated run' })).toBe('Orchestrated · 26 agents · 26 steps');
    expect(byOf({ name: 'live run slice with gaps' })).toBe('Build · 7 of 26 steps');
  });

  it('puts the agent count and what needs you on an Auto row, and nothing else', () => {
    const byOf = ({ name }: { readonly name: string }): string =>
      ROWS.find((row) => row.name === name)?.line.by ?? '';

    expect(byOf({ name: 'auto, nothing waiting' })).toBe('Auto · 3 agents');
    expect(byOf({ name: 'auto, waiting on you' })).toBe('Auto · 3 agents · 1 needs you');
  });
});
