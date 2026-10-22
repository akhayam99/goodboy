import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type OpenQuestion,
  type OpenQuestionId,
  type SessionId,
} from '@goodboy/types';
import type { RebaseSuggestionTarget, SessionSuggestion } from '../../../suggestions/types';
import type { NeedsYouOwner } from '../../timeline/needsYou';
import { actionCardsOf, type ActionCardModel, type AutoActionTarget } from './actionCardsOf';

type ActionCardSource = ActionCardModel['source'];

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger-core' });

const BASE = {
  sessionId: SESSION_ID,
  targetKey: null,
  detail: undefined,
} as const;

const ownerOf = (overrides: Partial<NeedsYouOwner> & Pick<NeedsYouOwner, 'id'>): NeedsYouOwner => ({
  kind: 'question',
  text: 'Cap per day or per payout?',
  where: 'Build step 4 waits on it',
  at: '2026-10-18T10:30:00.000Z',
  item: null,
  question: null,
  questionIds: [],
  prNumber: null,
  owed: null,
  mountId: null,
  ...overrides,
});

const FIX_CHECKS: SessionSuggestion = {
  ...BASE,
  id: 'fix-checks:ledger-core',
  kind: 'fix-checks',
  priority: 20,
  band: 1,
  title: 'Fix the failing static-analysis check',
  fingerprint: 'fix-checks:ledger-core',
  payload: { mountId: MOUNT_ID, projectName: 'ledger-core', prNumber: 309 },
};

const REBASE: SessionSuggestion = {
  ...BASE,
  id: 'rebase-project:ledger-core',
  kind: 'rebase-project',
  priority: 40,
  band: 2,
  title: 'Rebase ledger-core on main',
  fingerprint: 'rebase-project:ledger-core',
  payload: { targets: [] },
};

const CHECK_CHANGES: SessionSuggestion = {
  ...BASE,
  id: 'check-changes:agent-northwind',
  kind: 'check-changes',
  priority: 60,
  band: 3,
  title: 'Check the changes before you push',
  fingerprint: 'check-changes:agent-northwind',
  payload: { agentId: brandId<AgentId>({ value: 'agent-northwind' }) },
};

const ANSWER: SessionSuggestion = {
  ...BASE,
  id: 'answer-questions:session-harborline',
  kind: 'answer-questions',
  priority: 10,
  band: 0,
  title: 'Answer 1 question',
  fingerprint: 'answer-questions:session-harborline',
  payload: {
    count: 1,
    firstQuestion: { id: brandId({ value: 'question-cap' }), createdByAgentId: null },
    rootAgentId: null,
  },
};

const NEVER_STARTED: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-fixer' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-auto' }),
  role: 'Fixer',
  kind: 'neverStarted',
  noun: 'Fixer',
  reason: 'Auto created it at 10:21, no first message reached it.',
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
};

const QUESTION: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'question-cap' }),
  sessionId: SESSION_ID,
  text: 'Cap per day or per payout?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: brandId<IsoDateTime>({ value: '2026-10-18T10:30:00.000Z' }),
};

const NONE = { owners: [], suggestions: [], autoTargets: [] } as const;

type TargetParams = {
  readonly mountId: MountId;
};

const kindsOf = (cards: ReadonlyArray<{ readonly kind: string }>): ReadonlyArray<string> =>
  cards.map((card) => card.kind);

describe('actionCardsOf', () => {
  it('orders a question before a failing check, a rebase and a review', () => {
    const cards = actionCardsOf({
      ...NONE,
      owners: [ownerOf({ id: 'question-cap' })],
      suggestions: [CHECK_CHANGES, REBASE, FIX_CHECKS],
    });

    expect(kindsOf(cards)).toEqual(['question', 'fix-checks', 'rebase-project', 'check-changes']);
    expect(cards.map((card) => card.band)).toEqual([0, 1, 2, 3]);
  });

  it('puts a stopped rebase and a fix run owner in band 1 and an asking agent in band 0', () => {
    const cards = actionCardsOf({
      ...NONE,
      owners: [
        ownerOf({ id: 'rebase', kind: 'rebase' }),
        ownerOf({ id: 'fix-run', kind: 'fixRun' }),
        ownerOf({ id: 'agent', kind: 'agent' }),
      ],
    });

    expect(cards.map((card) => [card.kind, card.band])).toEqual([
      ['agent', 0],
      ['fixRun', 1],
      ['rebase', 1],
    ]);
  });

  it('puts a run with a question in band 0 and a run without one in band 1', () => {
    const asking = ownerOf({ id: 'run-asking', kind: 'run', question: QUESTION });
    const blocked = ownerOf({ id: 'run-blocked', kind: 'run' });

    const cards = actionCardsOf({ ...NONE, owners: [blocked, asking] });

    expect(cards.map((card) => [card.id, card.band])).toEqual([
      ['owner:run-asking', 0],
      ['owner:run-blocked', 1],
    ]);
  });

  it('says a question once when a run owns it and answer-questions counts it', () => {
    const cards = actionCardsOf({
      ...NONE,
      owners: [ownerOf({ id: 'run-build', kind: 'run', questionIds: ['question-cap'] })],
      suggestions: [ANSWER, REBASE],
    });

    expect(kindsOf(cards)).toEqual(['run', 'rebase-project']);
  });

  it('keeps answer-questions when no owner holds its question', () => {
    const cards = actionCardsOf({
      ...NONE,
      owners: [ownerOf({ id: 'other', questionIds: ['question-other'] })],
      suggestions: [ANSWER],
    });

    expect(kindsOf(cards)).toEqual(['question', 'answer-questions']);
  });

  it('puts a never started Auto child in band 0 and first', () => {
    const cards = actionCardsOf({
      ...NONE,
      owners: [ownerOf({ id: 'question-cap' })],
      suggestions: [FIX_CHECKS],
      autoTargets: [NEVER_STARTED],
    });

    expect(cards[0]).toMatchObject({
      id: 'auto:agent-fixer:neverStarted',
      band: 0,
      kind: 'neverStarted',
      title: 'Auto is stuck',
      detail: 'The fixer never started. Auto created it at 10:21, no first message reached it.',
    });
    expect(cards).toHaveLength(3);
  });

  it('says a blocked child by its role, never its ask quoted or its own words in another language', () => {
    const blocked = {
      ...NEVER_STARTED,
      agentId: brandId<AgentId>({ value: 'agent-scout' }),
      role: 'Map the center page routes',
      noun: 'Scout',
      kind: 'childBlocked',
      reason: 'Non riesco a chiudere: manca la fixture dei dati di esempio.',
      reasonCode: 'declared_blocked',
    } satisfies AutoActionTarget;
    const cards = actionCardsOf({
      ...NONE,
      autoTargets: [
        blocked,
        {
          ...blocked,
          agentId: brandId<AgentId>({ value: 'agent-tester' }),
          noun: 'Tester',
          kind: 'timedOut',
          reasonCode: 'deadline_passed',
        },
        {
          ...blocked,
          agentId: brandId<AgentId>({ value: 'agent-docs' }),
          noun: 'Docs writer',
          kind: 'failed',
          reasonCode: 'some_new_code',
        },
      ],
    });

    expect(cards.map((card) => [card.kind, card.title, card.detail])).toEqual([
      ['failed', 'Auto is stuck', 'The docs writer failed.'],
      ['childBlocked', 'Auto is stuck', 'The scout is blocked.'],
      ['timedOut', 'Auto is stuck', 'The tester timed out. It ran out of time.'],
    ]);
    expect(cards.every((card) => !(card.detail ?? '').includes('"'))).toBe(true);
  });

  it('breaks a tie by priority and then by id', () => {
    const first: SessionSuggestion = { ...REBASE, id: 'a', priority: 5 };
    const second: SessionSuggestion = { ...REBASE, id: 'b', priority: 5 };
    const third: SessionSuggestion = { ...REBASE, id: 'c', priority: 1 };

    const cards = actionCardsOf({ ...NONE, suggestions: [second, first, third] });

    expect(cards.map((card) => card.id)).toEqual(['suggestion:c', 'suggestion:a', 'suggestion:b']);
  });

  it('reads the mount from the payload, the pr target key, the owner target and else null', () => {
    const viaTargetKey: SessionSuggestion = {
      ...CHECK_CHANGES,
      id: 'via-target-key',
      targetKey: `pr:${MOUNT_ID}`,
    };
    const owner = ownerOf({
      id: 'fix-run',
      kind: 'fixRun',
      mountId: MOUNT_ID,
      owed: {
        questions: 0,
        toReview: 1,
        pushFailed: 0,
        couldntFix: 0,
        target: { threadId: 't1', mountId: MOUNT_ID, rank: 0 },
      },
    });

    const cards = actionCardsOf({
      owners: [owner, ownerOf({ id: 'plain' })],
      suggestions: [FIX_CHECKS, viaTargetKey, CHECK_CHANGES],
      autoTargets: [NEVER_STARTED],
    });
    const mountOf = (id: string) => cards.find((card) => card.id === id)?.mountId;

    expect(mountOf('suggestion:fix-checks:ledger-core')).toBe(MOUNT_ID);
    expect(mountOf('suggestion:via-target-key')).toBe(MOUNT_ID);
    expect(mountOf('owner:fix-run')).toBe(MOUNT_ID);
    expect(mountOf('owner:plain')).toBeNull();
    expect(mountOf('suggestion:check-changes:agent-northwind')).toBeNull();
    expect(mountOf('auto:agent-fixer:neverStarted')).toBeNull();
  });

  it('names an approval by its plan and version and puts an Auto child on its branch', () => {
    const cards = actionCardsOf({
      ...NONE,
      autoTargets: [
        { ...NEVER_STARTED, mountId: MOUNT_ID },
        {
          ...NEVER_STARTED,
          agentId: brandId<AgentId>({ value: 'agent-auto' }),
          role: 'Auto',
          noun: 'Auto',
          kind: 'approve',
          reason: null,
          plan: { name: 'Center pages rollout', version: 3, branchCount: 4 },
          canRetry: false,
        },
      ],
    });

    expect(cards.map((card) => [card.kind, card.mountId, card.detail])).toEqual([
      ['approve', null, 'Plan v3 waits on your OK. The run covers 4 branches.'],
      [
        'neverStarted',
        MOUNT_ID,
        'The fixer never started. Auto created it at 10:21, no first message reached it.',
      ],
    ]);
    expect(cards[0]?.title).toBe('Center pages rollout');
  });

  it('titles an approval without plan facts by Auto, and never quotes or prints a code', () => {
    const cards = actionCardsOf({
      ...NONE,
      autoTargets: [
        {
          ...NEVER_STARTED,
          agentId: brandId<AgentId>({ value: 'agent-auto' }),
          kind: 'approve',
          reason: null,
          plan: null,
          canRetry: false,
        },
        {
          ...NEVER_STARTED,
          kind: 'timedOut',
          reason: 'deadline_passed',
          reasonCode: 'deadline_passed',
        },
      ],
    });

    expect(cards.map((card) => [card.title, card.detail])).toEqual([
      ['Auto waits on your OK', 'The plan waits on your OK.'],
      ['Auto is stuck', 'The fixer timed out. It ran out of time.'],
    ]);
    expect(cards.some((card) => `${card.title}${card.detail}`.includes('"'))).toBe(false);
    expect(cards.some((card) => `${card.title}${card.detail}`.includes('_'))).toBe(false);
  });

  it('folds a stopped rebase into the behind card when its branch is behind', () => {
    const behind = brandId<MountId>({ value: 'mount-home' });
    const rebaseOf = ({ mountId }: TargetParams): RebaseSuggestionTarget => ({
      id: `${mountId}`,
      mountId,
      projectId: brandId({ value: 'project-harbor' }),
      projectName: 'harbor-portal',
      branch: `hl/${mountId}`,
      worktreePath: `/work/${mountId}`,
      baseBranch: 'main',
      behind: 3,
      dirtyCount: 0,
    });
    const rebase: SessionSuggestion = {
      ...BASE,
      id: 'rebase-project:ledger-core',
      kind: 'rebase-project',
      priority: 40,
      band: 2,
      title: 'Rebase harbor-portal',
      fingerprint: 'rebase-project:ledger-core',
      detail: '2 branches behind',
      payload: { targets: [rebaseOf({ mountId: behind }), rebaseOf({ mountId: MOUNT_ID })] },
    };
    const stoppedHere = ownerOf({ id: 'stop-home', kind: 'rebase', mountId: behind });
    const stoppedElsewhere = ownerOf({
      id: 'stop-other',
      kind: 'rebase',
      mountId: brandId<MountId>({ value: 'mount-up-to-date' }),
    });

    const cards = actionCardsOf({
      ...NONE,
      owners: [stoppedHere, stoppedElsewhere],
      suggestions: [rebase],
    });

    expect(cards.map((card) => card.id)).toEqual([
      'owner:stop-other',
      'suggestion:rebase-project:ledger-core',
    ]);
    expect(cards[1]?.detail).toBe('2 branches behind · 1 rebase stopped');
    expect(cards[1]?.folded.map((card) => card.id)).toEqual(['owner:stop-home']);
  });

  it('keeps a stopped rebase as its own card when no behind card exists', () => {
    const cards = actionCardsOf({
      ...NONE,
      owners: [ownerOf({ id: 'stop-home', kind: 'rebase', mountId: MOUNT_ID })],
    });

    expect(cards.map((card) => [card.id, card.mountId])).toEqual([['owner:stop-home', MOUNT_ID]]);
  });

  it('tags every card with its source and covers every source kind', () => {
    const cards = actionCardsOf({
      owners: [ownerOf({ id: 'question-cap' })],
      suggestions: [REBASE],
      autoTargets: [NEVER_STARTED],
    });
    const describeSource = (source: ActionCardSource): string => {
      switch (source.kind) {
        case 'owner':
          return `owner ${source.owner.id}`;
        case 'suggestion':
          return `suggestion ${source.suggestion.id}`;
        case 'auto':
          return `auto ${source.target.agentId}`;
        default: {
          const exhaustive: never = source;
          return exhaustive;
        }
      }
    };

    expect(cards.map((card) => describeSource(card.source))).toEqual([
      'auto agent-fixer',
      'owner question-cap',
      'suggestion rebase-project:ledger-core',
    ]);
  });

  it('returns no card for no source', () => {
    expect(actionCardsOf(NONE)).toEqual([]);
  });
});
