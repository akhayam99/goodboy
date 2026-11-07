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
import { actionCardsOf, type AutoActionTarget } from '../next/actionCardsOf';
import { failedCardCountOf } from '../next/failedCardCountOf';
import { overviewCardsOf } from '../overviewCardsOf';
import { overviewGlanceOf } from '../overviewGlanceOf';
import { liveGroupsOf } from './liveGroupsOf';
import { liveSectionIdOf } from './liveSectionIdOf';
import { NOW_SESSION, NOW_STARTED_AT, nowModelOf } from './testing/nowModelOf';
import { uncardedGroupsOf } from './uncardedGroupsOf';
import { waitingGroupsOf } from './waitingGroupsOf';
import { autoGlancesBesideCardsOf } from '../autoGlancesBesideCardsOf';

const ROOT = anAgent({
  id: FIXTURE_ROOT,
  sessionId: NOW_SESSION,
  kind: 'auto',
  name: 'Harden retries in payments-api',
  status: 'running',
  startedAt: NOW_STARTED_AT,
});

const SCOUT = anAgent({
  id: brandId<AgentId>({ value: 'agent-scout' }),
  sessionId: NOW_SESSION,
  parentAgentId: FIXTURE_ROOT,
  name: 'Scout',
  status: 'blocked',
});

const AGENTS = [ROOT, SCOUT];

const BLOCKED: AutoActionTarget = {
  agentId: FIXTURE_ROOT,
  rootAgentId: FIXTURE_ROOT,
  role: 'Auto',
  noun: 'Auto',
  kind: 'blocked',
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: false,
};

const STUCK_CHILD: AutoActionTarget = {
  ...BLOCKED,
  agentId: SCOUT.id,
  role: 'scout',
  noun: 'Scout',
  kind: 'childBlocked',
};

type GroupsParams = {
  readonly phase: 'waiting' | 'blocked';
};

const groupsOf = ({ phase }: GroupsParams) => {
  const view = aView({
    phase,
    delegations: [
      aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'blocked' }),
    ],
  });
  return liveGroupsOf({
    model: nowModelOf({ agents: AGENTS, autoTrees: [view] }),
    agents: AGENTS,
    now: FIXTURE_NOW,
  });
};

describe('uncardedGroupsOf', () => {
  it('counts a stuck child once: the card speaks, the Auto row does not add to the count', () => {
    const groups = groupsOf({ phase: 'waiting' });
    const cards = actionCardsOf({ owners: [], suggestions: [], autoTargets: [STUCK_CHILD] });
    const waiting = waitingGroupsOf({ groups, cards });

    expect(waiting).toHaveLength(1);
    expect(uncardedGroupsOf({ groups: waiting, cards })).toHaveLength(0);
    expect(uncardedGroupsOf({ groups: waiting, cards: [] })).toHaveLength(1);
    expect(
      overviewCardsOf({
        cards,
        waitingCount: uncardedGroupsOf({ groups: waiting, cards }).length,
        runningCount: 0,
        stuckCount: 0,
        branchCount: 0,
        doneCount: 0,
        isArchived: false,
      }).find((card) => card.id === 'needs-you')?.count,
    ).toBe(1);
  });

  it('counts a failed Auto once: the card row says Failed, the glance reads Auto failed', () => {
    const groups = groupsOf({ phase: 'blocked' });
    const cards = actionCardsOf({ owners: [], suggestions: [], autoTargets: [BLOCKED] });
    const stuckCount = uncardedGroupsOf({ groups, cards }).filter(
      (group) => liveSectionIdOf({ group }) === 'stopped',
    ).length;
    const glance = overviewGlanceOf({
      cards: overviewCardsOf({
        cards,
        waitingCount: 0,
        runningCount: 0,
        stuckCount,
        branchCount: 0,
        doneCount: 0,
        isArchived: false,
      }),
      stuckCount,
      failedCount: failedCardCountOf({ cards }),
      autoGlances: autoGlancesBesideCardsOf({
        views: [aView({ phase: 'blocked' })],
        rootTurns: [null],
        cards,
      }),
      nextTitle: null,
    });

    expect(stuckCount).toBe(0);
    expect(glance.sentence).toBe('Auto failed');
  });

  it('keeps the failed Auto as a stopped row when no card speaks for it', () => {
    const groups = groupsOf({ phase: 'blocked' });

    expect(
      uncardedGroupsOf({ groups, cards: [] }).filter(
        (group) => liveSectionIdOf({ group }) === 'stopped',
      ),
    ).toHaveLength(1);
  });
});
