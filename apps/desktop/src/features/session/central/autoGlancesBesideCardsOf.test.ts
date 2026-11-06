// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { FIXTURE_ROOT, aPlanRow, aView } from '../../auto/testing/autoViewFixtures';
import { autoGlancesBesideCardsOf } from './autoGlancesBesideCardsOf';
import { actionCardsOf, type AutoActionTarget } from './next/actionCardsOf';
import { overviewCardsOf } from './overviewCardsOf';
import { overviewGlanceOf } from './overviewGlanceOf';

const APPROVE: AutoActionTarget = {
  agentId: FIXTURE_ROOT,
  rootAgentId: FIXTURE_ROOT,
  role: 'planner',
  noun: 'Planner',
  kind: 'approve',
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: false,
};

const OTHER_ROOT = brandId<AgentId>({ value: 'agent-auto-other' });

const WAITING_VIEW = aView({ phase: 'waiting', artifacts: [aPlanRow()] });

const OTHER_VIEW = {
  ...aView({ phase: 'waiting', artifacts: [aPlanRow()] }),
  tree: { ...WAITING_VIEW.tree, rootAgentId: OTHER_ROOT },
};

const cardsFor = ({ targets }: { readonly targets: ReadonlyArray<AutoActionTarget> }) =>
  actionCardsOf({ owners: [], suggestions: [], autoTargets: targets });

describe('autoGlancesBesideCardsOf', () => {
  it('says the Auto glance when no card speaks for the tree', () => {
    const glances = autoGlancesBesideCardsOf({
      views: [WAITING_VIEW],
      rootTurns: [null],
      cards: [],
    });

    expect(glances.map((glance) => glance.state)).toEqual(['waiting']);
  });

  it('drops the glance of a tree that already has a card', () => {
    const glances = autoGlancesBesideCardsOf({
      views: [WAITING_VIEW, OTHER_VIEW],
      rootTurns: [null, null],
      cards: cardsFor({ targets: [APPROVE] }),
    });

    expect(glances).toHaveLength(1);
  });

  it('counts one plan once in the overview sentence', () => {
    const cards = cardsFor({ targets: [APPROVE] });
    const glance = overviewGlanceOf({
      cards: overviewCardsOf({
        cards,
        waitingCount: 0,
        runningCount: 0,
        stuckCount: 0,
        branchCount: 0,
        doneCount: 0,
        isArchived: false,
      }),
      stuckCount: 0,
      nextTitle: null,
      autoGlances: autoGlancesBesideCardsOf({ views: [WAITING_VIEW], rootTurns: [null], cards }),
    });

    expect(glance.sentence).toBe('1 waiting for you');
  });
});
