import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type AutoTreeId } from '@goodboy/types';
import { askingAutoRootOf } from './askingAutoRootOf';
import { aDelegation, aTree, aView } from './testing/autoViewFixtures';

const ROLLOUT = brandId<AgentId>({ value: 'agent-auto-rollout' });
const PROFILE = brandId<AgentId>({ value: 'agent-auto-profile' });
const PLANNER = brandId<AgentId>({ value: 'agent-rollout-planner' });

const VIEWS = [
  {
    ...aView({}),
    tree: { ...aTree({}), rootAgentId: ROLLOUT },
    delegations: [
      {
        ...aDelegation({ key: 'planner', role: 'planner', state: 'accepted' }),
        childAgentId: PLANNER,
      },
    ],
  },
  {
    ...aView({}),
    tree: {
      ...aTree({}),
      id: brandId<AutoTreeId>({ value: 'tree-profile' }),
      rootAgentId: PROFILE,
    },
    delegations: [],
  },
];

describe('askingAutoRootOf', () => {
  it('names the Auto run when its root or a child asked every question', () => {
    expect(
      askingAutoRootOf({
        views: VIEWS,
        questions: [{ createdByAgentId: ROLLOUT }, { createdByAgentId: PLANNER }],
      }),
    ).toBe(ROLLOUT);
  });

  it('names no run when two runs asked, an agent outside Auto asked, or nobody did', () => {
    expect(
      askingAutoRootOf({
        views: VIEWS,
        questions: [{ createdByAgentId: ROLLOUT }, { createdByAgentId: PROFILE }],
      }),
    ).toBeNull();
    expect(
      askingAutoRootOf({
        views: VIEWS,
        questions: [{ createdByAgentId: brandId<AgentId>({ value: 'agent-chat' }) }],
      }),
    ).toBeNull();
    expect(askingAutoRootOf({ views: VIEWS, questions: [{ createdByAgentId: null }] })).toBeNull();
    expect(askingAutoRootOf({ views: VIEWS, questions: [] })).toBeNull();
  });
});
