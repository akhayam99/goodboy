import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import type { SessionSuggestion } from '../../../suggestions/types';
import { actionCardsOf, type ActionCardModel, type AutoActionTarget } from './actionCardsOf';
import { nextGroupsOf } from './nextGroupsOf';
import { nextSeenKeyOf } from './nextSeenKeyOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const ROOT = brandId<AgentId>({ value: 'agent-auto-rollout' });

type MountParams = {
  readonly page: string;
};

const mountOf = ({ page }: MountParams): MountId => brandId<MountId>({ value: `mount-${page}` });

type ChildParams = MountParams & {
  readonly kind: AutoActionTarget['kind'];
};

const childOf = ({ page, kind }: ChildParams): AutoActionTarget => ({
  agentId: brandId<AgentId>({ value: `agent-${page}` }),
  rootAgentId: ROOT,
  role: page,
  noun: 'Implementer',
  kind,
  reason: null,
  reasonCode: null,
  mountId: mountOf({ page }),
  plan: null,
  canRetry: true,
});

const APPROVE: AutoActionTarget = {
  ...childOf({ page: 'rollout', kind: 'approve' }),
  agentId: ROOT,
  mountId: null,
  plan: { name: 'Center pages rollout', version: 3, branchCount: 4 },
  canRetry: false,
};

const pushOf = ({ page }: MountParams): SessionSuggestion => ({
  id: `push-branch:${page}`,
  kind: 'push-branch',
  priority: 41,
  band: 2,
  title: `Push hl/feat-center-${page}-page`,
  sessionId: SESSION_ID,
  fingerprint: `push-branch:${page}`,
  targetKey: `branch:${mountOf({ page })}`,
  payload: {
    mountId: mountOf({ page }),
    projectId: brandId({ value: 'project-harbor' }),
    projectName: 'harbor-portal',
    branch: `hl/feat-center-${page}-page`,
    worktreePath: `/work/${page}`,
    state: page === 'settings' ? 'diverged' : 'ahead',
    ahead: 2,
    behind: page === 'settings' ? 1 : 0,
  },
});

type CardsParams = {
  readonly autoTargets: ReadonlyArray<AutoActionTarget>;
  readonly suggestions?: ReadonlyArray<SessionSuggestion>;
};

const cardsOf = ({ autoTargets, suggestions = [] }: CardsParams) =>
  actionCardsOf({ owners: [], suggestions, autoTargets });

type ShapeParams = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly seen?: ReadonlyArray<string>;
};

const shapeOf = ({ cards, seen = [] }: ShapeParams) =>
  nextGroupsOf({ cards, seen }).map((group) => [group.id, group.rows.map((row) => row.id)]);

describe('nextGroupsOf', () => {
  it('draws Decide, Fix, Update and Ship in that order and skips an empty group', () => {
    const cards = cardsOf({
      autoTargets: [childOf({ page: 'home', kind: 'timedOut' }), APPROVE],
      suggestions: [pushOf({ page: 'faq' }), pushOf({ page: 'settings' })],
    });

    expect(nextGroupsOf({ cards, seen: [] }).map((group) => group.label)).toEqual([
      'Decide',
      'Fix',
      'Update',
      'Ship',
    ]);
    expect(
      nextGroupsOf({
        cards: cardsOf({ autoTargets: [childOf({ page: 'home', kind: 'failed' })] }),
        seen: [],
      }).map((group) => group.id),
    ).toEqual(['fix']);
  });

  it('keeps every row in place when a refresh brings a new item, which lands at the end', () => {
    const before = cardsOf({
      autoTargets: [
        childOf({ page: 'search', kind: 'neverStarted' }),
        childOf({ page: 'billing', kind: 'timedOut' }),
      ],
    });
    const seen = nextGroupsOf({ cards: before, seen: [] }).flatMap((group) =>
      group.rows.map((card) => nextSeenKeyOf({ group: group.id, card })),
    );
    const after = cardsOf({
      autoTargets: [
        childOf({ page: 'about', kind: 'childBlocked' }),
        childOf({ page: 'billing', kind: 'timedOut' }),
        childOf({ page: 'search', kind: 'neverStarted' }),
      ],
    });

    expect(shapeOf({ cards: before, seen })).toEqual([
      ['fix', ['auto:agent-billing:timedOut', 'auto:agent-search:neverStarted']],
    ]);
    expect(shapeOf({ cards: after, seen })).toEqual([
      [
        'fix',
        [
          'auto:agent-billing:timedOut',
          'auto:agent-search:neverStarted',
          'auto:agent-about:childBlocked',
        ],
      ],
    ]);
  });

  it('orders a group by its own first seen rows, not by a subject seen in another group', () => {
    const scout = childOf({ page: 'search', kind: 'neverStarted' });
    const cards = cardsOf({
      autoTargets: [scout],
      suggestions: [pushOf({ page: 'search' }), pushOf({ page: 'faq' })],
    });
    const seen = nextGroupsOf({ cards, seen: [] }).flatMap((group) =>
      group.rows.map((card) => nextSeenKeyOf({ group: group.id, card })),
    );

    expect(shapeOf({ cards, seen })).toEqual([
      ['fix', ['auto:agent-search:neverStarted']],
      ['ship', ['suggestion:push-branch:faq', 'suggestion:push-branch:search']],
    ]);
  });

  it('puts what unblocks most first inside a group, then what was seen first', () => {
    const rebaseAll: SessionSuggestion = {
      id: 'rebase-project:harbor',
      kind: 'rebase-project',
      priority: 30,
      band: 2,
      title: 'Rebase 3 branches on main',
      sessionId: SESSION_ID,
      fingerprint: 'rebase-project:harbor',
      targetKey: 'project:harbor',
      payload: {
        targets: ['home', 'billing', 'team'].map((page) => ({
          id: `target-${page}`,
          mountId: mountOf({ page }),
          projectId: brandId({ value: 'project-harbor' }),
          projectName: 'harbor-portal',
          branch: `hl/feat-center-${page}-page`,
          worktreePath: `/work/${page}`,
          baseBranch: 'main',
          behind: 2,
          dirtyCount: 0,
        })),
      },
    };
    const cards = cardsOf({
      autoTargets: [],
      suggestions: [pushOf({ page: 'settings' }), rebaseAll],
    });
    const seen = nextGroupsOf({
      cards: cardsOf({ autoTargets: [], suggestions: [pushOf({ page: 'settings' })] }),
      seen: [],
    }).flatMap((group) => group.rows.map((card) => nextSeenKeyOf({ group: group.id, card })));
    expect(seen).toHaveLength(1);

    expect(shapeOf({ cards, seen })).toEqual([
      ['update', ['suggestion:rebase-project:harbor', 'suggestion:push-branch:settings']],
    ]);
  });

  it('keeps rows of the same reach in the order they were first seen across a refresh', () => {
    const before = cardsOf({
      autoTargets: [
        childOf({ page: 'search', kind: 'neverStarted' }),
        childOf({ page: 'billing', kind: 'neverStarted' }),
      ],
    });
    const seen = nextGroupsOf({ cards: before, seen: [] }).flatMap((group) =>
      group.rows.map((card) => nextSeenKeyOf({ group: group.id, card })),
    );
    const after = cardsOf({
      autoTargets: [
        childOf({ page: 'billing', kind: 'neverStarted' }),
        childOf({ page: 'search', kind: 'neverStarted' }),
      ],
    });

    expect(shapeOf({ cards: after, seen })).toEqual(shapeOf({ cards: before, seen }));
  });

  it('puts Archive this session last in Ship, after a push, as a row of its own', () => {
    const archive: SessionSuggestion = {
      id: 'archive-session:session-harborline',
      kind: 'archive-session',
      priority: 52,
      band: 3,
      title: 'Archive this session',
      detail: 'All branches merged',
      sessionId: SESSION_ID,
      fingerprint: 'archive-session:session-harborline:1',
      targetKey: `archive:${SESSION_ID}`,
      payload: { branchCount: 1 },
    };
    const cards = cardsOf({
      autoTargets: [],
      suggestions: [archive, pushOf({ page: 'faq' })],
    });

    expect(shapeOf({ cards })).toEqual([
      ['ship', ['suggestion:push-branch:faq', 'suggestion:archive-session:session-harborline']],
    ]);
  });
});
