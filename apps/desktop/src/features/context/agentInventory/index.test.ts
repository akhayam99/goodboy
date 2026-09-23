import { describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import { buildAgentInventory } from './index';

const inventoryFor = ({ value }: { readonly value: string }) =>
  buildAgentInventory({
    agentId: 'agent-1' as AgentId,
    agents: [],
    slots: [{ key: 'decisions', value, enabled: true }],
    deliveredSlotKeys: [],
    plans: [],
    questions: [],
    holds: [],
    obligations: [],
    graphs: [],
  }).inventory;

describe('buildAgentInventory', () => {
  it('moves the revision when a source is replaced by different text of the same length', () => {
    const before = inventoryFor({ value: 'use sqlite' });
    const after = inventoryFor({ value: 'use sqlxte' });

    expect(after.entries[0]?.revision).not.toBe(before.entries[0]?.revision);
    expect(after.revision).not.toBe(before.revision);
  });
});
