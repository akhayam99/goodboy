// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type WorktreeStatus } from '@goodboy/types';
import { actionCardsOf, type AutoActionTarget } from '../../central/next/actionCardsOf';
import { dockChangesOf } from './dockChangesOf';
import { dockNextOf } from './dockNextOf';

const BRANCH = 'hl/reinstall-deps';

type StatusParams = {
  readonly changed: number;
  readonly ahead: number;
};

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

const OPENS = () => true;

const cardsOf = (targets: ReadonlyArray<AutoActionTarget>) =>
  actionCardsOf({ owners: [], suggestions: [], autoTargets: targets });

describe('dockNextOf', () => {
  it('names nothing when the session has nothing else', () => {
    expect(dockNextOf({ cards: [], agentId: HERE, canOpen: OPENS })).toBeNull();
  });

  it('skips the ask of this conversation, the dock already shows it', () => {
    const cards = cardsOf([targetOf(HERE)]);

    expect(dockNextOf({ cards, agentId: HERE, canOpen: OPENS })).toBeNull();
    expect(dockNextOf({ cards, agentId: ROOT, canOpen: OPENS })).toBeNull();
  });

  it('offers what waits elsewhere, from the same cards as the Overview', () => {
    const other = brandId<AgentId>({ value: 'agent-other' });
    const cards = cardsOf([targetOf(other)]);

    expect(dockNextOf({ cards, agentId: HERE, canOpen: OPENS })?.card.id).toBe(cards[0]?.id);
    expect(dockNextOf({ cards, agentId: HERE, canOpen: OPENS })?.moreCount).toBe(0);
  });

  it('leads with the first card that has a door, even when a card without one comes first', () => {
    const first = brandId<AgentId>({ value: 'agent-first' });
    const second = brandId<AgentId>({ value: 'agent-second' });
    const cards = cardsOf([targetOf(first, first), targetOf(second, second)]);
    const rows = dockNextOf({ cards, agentId: HERE, canOpen: OPENS });
    const leading = rows?.card;
    const result = dockNextOf({
      cards,
      agentId: HERE,
      canOpen: ({ card }) => card.id !== leading?.id,
    });

    expect(cards).toHaveLength(2);
    expect(leading?.id).toBe(cards[0]?.id);
    expect(result?.card.id).toBe(cards[1]?.id);
    expect(result?.moreCount).toBe(0);
  });

  it('names nothing when no card has a door', () => {
    const other = brandId<AgentId>({ value: 'agent-other' });
    const cards = cardsOf([targetOf(other)]);

    expect(dockNextOf({ cards, agentId: HERE, canOpen: () => false })).toBeNull();
  });
});

describe('dockChangesOf', () => {
  const statusOf = ({ changed, ahead }: StatusParams): WorktreeStatus => ({
    branch: BRANCH,
    head: null,
    headSubject: null,
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    mainDistance: { kind: 'known', ahead, behind: 0 },
    workingTree: {
      kind: 'known',
      staged: 0,
      unstaged: changed,
      untracked: 0,
      unmerged: 0,
      changed,
    },
    upstream: null,
    inProgress: null,
  });

  it('has no line before the status is read', () => {
    expect(dockChangesOf({ status: undefined, branch: BRANCH })).toBeNull();
  });

  it('counts the changed files of the branch', () => {
    const status = statusOf({ changed: 2, ahead: 0 });

    expect(dockChangesOf({ status, branch: BRANCH })).toBe('2 files changed on hl/reinstall-deps');
  });

  it('counts the commits once the files are committed', () => {
    const status = statusOf({ changed: 0, ahead: 3 });

    expect(dockChangesOf({ status, branch: BRANCH })).toBe('3 commits on hl/reinstall-deps');
  });

  it('means no dock when nothing changed', () => {
    const status = statusOf({ changed: 0, ahead: 0 });

    expect(dockChangesOf({ status, branch: BRANCH })).toBeNull();
  });
});
