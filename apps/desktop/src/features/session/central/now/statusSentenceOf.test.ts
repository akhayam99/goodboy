// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  aDelegation,
  aView,
  FIXTURE_NOW,
  FIXTURE_ROOT,
} from '../../../auto/testing/autoViewFixtures';
import type { AgentKind } from '../../agent-kind';
import { branchFactsOf } from '../branches/branchFactsOf';
import { aMountRow, aRequest } from '../branches/testing/aMountRow';
import { liveGroupsOf, type LiveGroupModel } from './liveGroupsOf';
import { nowStateOf } from './nowStateOf';
import { statusSentenceOf } from './statusSentenceOf';
import type { AutoActionTarget } from '../next/actionCardsOf';
import { aQuestionCard, anAutoCard } from './testing/nowCards';
import {
  aNowAgent,
  aNowRun,
  aNowStepAgent,
  aNowWorkflow,
  NOW_SESSION,
  NOW_STARTED_AT,
  nowModelOf,
} from './testing/nowModelOf';

const BUILD_STEPS = ['Scope', 'Tests', 'Implement', 'Review', 'Docs', 'Ship'];

const buildGroups = (): ReadonlyArray<LiveGroupModel> => {
  const attached = aNowRun({
    key: 'build',
    title: 'Build',
    workflow: aNowWorkflow({ key: 'build', name: 'Build', stepNames: BUILD_STEPS }),
  });
  const agents = [
    aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: 'Scope' }),
    aNowStepAgent({ attached, stepIndex: 1, status: 'completed', name: 'Tests' }),
    aNowStepAgent({ attached, stepIndex: 2, status: 'running', name: 'Implement' }),
  ];
  return liveGroupsOf({
    model: nowModelOf({ agents, runs: [attached] }),
    agents,
    now: FIXTURE_NOW,
  });
};

const orchestratedGroups = ({
  isDeciding,
}: {
  readonly isDeciding: boolean;
}): ReadonlyArray<LiveGroupModel> => {
  const attached = aNowRun({
    key: 'orch',
    title: 'Payout run',
    isDynamic: true,
    workflow: aNowWorkflow({
      key: 'orch',
      name: 'Orchestrated',
      stepNames: ['Scope', 'Tests', 'Plan', 'Map the payout code'],
      origin: 'orchestrated',
    }),
  });
  const agents = [
    aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: 'Scope' }),
    aNowStepAgent({ attached, stepIndex: 1, status: 'completed', name: 'Tests' }),
    aNowStepAgent({ attached, stepIndex: 2, status: 'completed', name: 'Plan' }),
    aNowStepAgent({
      attached,
      stepIndex: 3,
      status: isDeciding ? 'completed' : 'running',
      name: 'Map the payout code',
    }),
  ];
  return liveGroupsOf({
    model: nowModelOf({
      agents,
      runs: [attached],
      decidingRunIds: isDeciding ? new Set([attached.run.id]) : new Set(),
    }),
    agents,
    now: FIXTURE_NOW,
  });
};

const autoGroups = ({
  state,
}: {
  readonly state: 'running' | 'neverStarted';
}): ReadonlyArray<LiveGroupModel> => {
  const root = anAgent({
    id: FIXTURE_ROOT,
    sessionId: NOW_SESSION,
    kind: 'auto',
    name: 'Check the payout docs',
    status: 'running',
    startedAt: NOW_STARTED_AT,
  });
  const agents = [root];
  const view = aView({
    phase: 'waiting',
    delegations: [
      {
        ...aDelegation({
          key: 'fixer',
          role: 'implementer',
          state: state === 'running' ? 'running' : 'accepted',
        }),
        createdAt: state === 'running' ? FIXTURE_NOW : FIXTURE_NOW - 120_000,
      },
    ],
  });
  return liveGroupsOf({
    model: nowModelOf({ agents, autoTrees: [view] }),
    agents,
    now: FIXTURE_NOW,
  });
};

const agentGroups = ({
  status,
  kind,
  stoppedBy,
}: {
  readonly status: 'running' | 'stopped';
  readonly kind?: AgentKind;
  readonly stoppedBy?: 'you' | 'app';
}): ReadonlyArray<LiveGroupModel> => {
  const agents = [aNowAgent({ key: 'impl', name: 'Add the limit table', status, kind, stoppedBy })];
  return liveGroupsOf({ model: nowModelOf({ agents }), agents, now: FIXTURE_NOW });
};

const sentence = ({
  groups,
  cards = [],
  doneOutcome = null,
  facts = [],
}: {
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly cards?: Parameters<typeof statusSentenceOf>[0]['cards'];
  readonly doneOutcome?: string | null;
  readonly facts?: Parameters<typeof statusSentenceOf>[0]['facts'];
}) => statusSentenceOf({ groups, cards, doneOutcome, facts });

describe('statusSentenceOf when the work is finished', () => {
  const facts = branchFactsOf({
    rows: [
      aMountRow({
        key: 'api',
        projectName: 'payments-api',
        branch: 'ak/eng-1190-tenant-limits',
        request: aRequest({ provider: 'github', number: 309, checks: 'success' }),
      }),
    ],
    fetchedAtByMountId: new Map([['mount-api', new Date().toISOString()]]),
    behindByMountId: new Map(),
    liveCountByMountId: new Map(),
    now: Date.now(),
  });

  it('builds the sentence from the request and its checks', () => {
    expect(sentence({ groups: [], doneOutcome: 'Wrote the retry tests', facts })).toBe(
      'Checks passed on #309. Ready for review.',
    );
  });

  it('keeps the done outcome when no request exists', () => {
    expect(sentence({ groups: [], doneOutcome: 'Wrote the retry tests' })).toBe(
      'Wrote the retry tests.',
    );
  });
});

describe('statusSentenceOf', () => {
  it('names the step of a run out of its total', () => {
    expect(sentence({ groups: buildGroups() })).toBe('Build is on step 3 of 6, Implement.');
  });

  it('names the step of an orchestrated run without a total', () => {
    expect(sentence({ groups: orchestratedGroups({ isDeciding: false }) })).toBe(
      'The orchestrator is on step 4, Map the payout code.',
    );
  });

  it('says the orchestrator is deciding between steps', () => {
    expect(sentence({ groups: orchestratedGroups({ isDeciding: true }) })).toBe(
      'The orchestrator is deciding the next step.',
    );
  });

  it('reads the Auto word, and names a child that never started', () => {
    expect(sentence({ groups: autoGroups({ state: 'running' }) })).toBe(
      'Auto is waiting for Implementer.',
    );
    expect(sentence({ groups: autoGroups({ state: 'neverStarted' }) })).toBe(
      'Auto is stuck: Implementer never started.',
    );
  });

  it('names a single agent and what it works on', () => {
    expect(sentence({ groups: agentGroups({ status: 'running' }) })).toBe(
      'Generalist is working on Add the limit table.',
    );
  });

  it('says an agent stopped by a restart', () => {
    expect(sentence({ groups: agentGroups({ status: 'stopped', stoppedBy: 'app' }) })).toBe(
      'Generalist stopped when Goodboy closed.',
    );
  });

  it('adds the first urgent card as a second sentence', () => {
    expect(
      sentence({
        groups: buildGroups(),
        cards: [aQuestionCard({ where: 'Review' })],
      }),
    ).toBe('Build is on step 3 of 6, Implement. Review waits on one answer from you.');
  });

  it('counts several urgent cards instead of naming them', () => {
    expect(
      sentence({
        groups: buildGroups(),
        cards: [aQuestionCard({ where: 'Review' }), aQuestionCard({ where: 'Docs' })],
      }),
    ).toBe('Build is on step 3 of 6, Implement. 2 things wait on you.');
  });

  it('does not say a never started child twice', () => {
    const target = {
      agentId: brandId<AgentId>({ value: 'agent-fixer' }),
      rootAgentId: FIXTURE_ROOT,
      role: 'Implementer',
      kind: 'neverStarted',
      reason: 'No first message reached it.',
      canRetry: true,
    } satisfies AutoActionTarget;
    expect(
      sentence({ groups: autoGroups({ state: 'neverStarted' }), cards: [anAutoCard({ target })] }),
    ).toBe('Auto is stuck: Implementer never started.');
  });

  it('names two groups and counts the rest', () => {
    const [first] = buildGroups();
    const [second] = autoGroups({ state: 'running' });
    const [third] = agentGroups({ status: 'running' });
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('fixture groups missing');
    }
    expect(sentence({ groups: [first, second, third, third, third] })).toBe(
      'Build is on step 3 of 6, Implement, Auto is waiting for Implementer, and 3 more.',
    );
  });

  it('falls back to the newest done outcome, then to nothing has run', () => {
    expect(sentence({ groups: [], doneOutcome: 'Checks passed on #309. Ready for review.' })).toBe(
      'Checks passed on #309. Ready for review.',
    );
    expect(sentence({ groups: [] })).toBe('Nothing has run yet.');
  });

  it('never writes an em or en dash', () => {
    const outputs = [
      sentence({ groups: buildGroups() }),
      sentence({ groups: orchestratedGroups({ isDeciding: true }) }),
      sentence({ groups: autoGroups({ state: 'neverStarted' }) }),
      sentence({ groups: agentGroups({ status: 'stopped', stoppedBy: 'app' }) }),
      sentence({ groups: [] }),
    ];
    for (const output of outputs) {
      expect(output.includes(String.fromCharCode(8211))).toBe(false);
      expect(output.includes(String.fromCharCode(8212))).toBe(false);
    }
  });
});

describe('nowStateOf', () => {
  const base = { cards: [], hasMergedRequest: false, hasDoneWork: false };

  it('is Stuck first, whatever else waits', () => {
    expect(
      nowStateOf({
        ...base,
        groups: autoGroups({ state: 'neverStarted' }),
        cards: [aQuestionCard({ where: null })],
      }),
    ).toBe('stuck');
  });

  it('needs you for an urgent card', () => {
    expect(
      nowStateOf({ ...base, groups: buildGroups(), cards: [aQuestionCard({ where: null })] }),
    ).toBe('waiting');
  });

  it('is Working while a group runs', () => {
    expect(nowStateOf({ ...base, groups: buildGroups() })).toBe('working');
  });

  it('is Done with finished work and nothing live or urgent', () => {
    expect(nowStateOf({ ...base, groups: [], hasDoneWork: true })).toBe('done');
    expect(nowStateOf({ ...base, groups: [], hasMergedRequest: true })).toBe('done');
  });

  it('is Idle when nothing has run', () => {
    expect(nowStateOf({ ...base, groups: [] })).toBe('idle');
  });
});
