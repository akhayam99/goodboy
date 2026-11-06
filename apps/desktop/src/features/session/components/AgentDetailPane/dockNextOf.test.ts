// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { actionCardsOf, type AutoActionTarget } from '../../central/next/actionCardsOf';
import { dockChangesOf } from './dockChangesOf';
import { dockNextOf } from './dockNextOf';

const HERE = brandId<AgentId>({ value: 'agent-here' });
const ROOT = brandId<AgentId>({ value: 'agent-root' });

const targetOf = (agentId: AgentId, rootAgentId: AgentId = ROOT): AutoActionTarget => ({
  agentId,
  rootAgentId,
  role: 'implementer',
  noun: 'Implementer',
  kind: 'approve',
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: false,
});

const cardsOf = (targets: ReadonlyArray<AutoActionTarget>) =>
  actionCardsOf({ owners: [], suggestions: [], autoTargets: targets });

describe('dockNextOf', () => {
  it('names nothing when the session has nothing else', () => {
    expect(dockNextOf({ cards: [], agentId: HERE })).toBeNull();
  });

  it('skips the ask of this conversation, the dock already shows it', () => {
    const cards = cardsOf([targetOf(HERE)]);

    expect(dockNextOf({ cards, agentId: HERE })).toBeNull();
    expect(dockNextOf({ cards, agentId: ROOT })).toBeNull();
  });

  it('offers what waits elsewhere, from the same cards as the Overview', () => {
    const other = brandId<AgentId>({ value: 'agent-other' });
    const cards = cardsOf([targetOf(other)]);

    expect(dockNextOf({ cards, agentId: HERE })?.card.id).toBe(cards[0]?.id);
    expect(dockNextOf({ cards, agentId: HERE })?.moreCount).toBe(0);
  });
});

describe('dockChangesOf', () => {
  it('has no line before the status is read', () => {
    expect(dockChangesOf({ status: undefined, branch: 'hl/reinstall-deps' })).toBeNull();
  });
});
