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
    ['running', 'Lead is working on this branch.'],
    ['needsYou', 'Lead waits for you on this branch.'],
    ['done', 'Lead finished its work on this branch.'],
  ] as const)('names the Lead for a %s lead', (dot, line) => {
    expect(branchStoryLineOf({ leads: [leadOf(dot)] })).toBe(line);
  });

  it('says nothing without a lead', () => {
    expect(branchStoryLineOf({ leads: [] })).toBeNull();
  });
});
