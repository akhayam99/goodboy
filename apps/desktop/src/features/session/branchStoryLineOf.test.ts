import { describe, expect, it } from 'vitest';
import { agentIdOf } from '../../__tests__/helpers/brandedIds';
import type { BranchLead } from './branchLeadsOf';
import { branchStoryLineOf } from './branchStoryLineOf';

const leadOf = (dot: BranchLead['dot']): BranchLead => ({
  id: `lead-${dot}`,
  agentId: agentIdOf({ value: 'agent-1' }),
  title: 'Retry ledger sync',
  dot,
  stateWord: 'Running',
  spendUsd: 0,
  alsoOn: [],
  items: [],
});

describe('branchStoryLineOf', () => {
  it.each([
    ['Auto', 'running', 'Auto is working on this branch.'],
    ['Lead', 'running', 'Lead is working on this branch.'],
    ['Auto', 'needsYou', 'Auto waits for you on this branch.'],
    ['Lead', 'done', 'Lead finished its work on this branch.'],
  ] as const)('says %s for a %s lead', (word, dot, line) => {
    expect(branchStoryLineOf({ leads: [leadOf(dot)], word })).toBe(line);
  });

  it('says nothing without a lead', () => {
    expect(branchStoryLineOf({ leads: [], word: 'Lead' })).toBeNull();
  });
});
