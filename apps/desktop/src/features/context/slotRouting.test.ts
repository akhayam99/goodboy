// @vitest-environment node
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ROLE_REGISTRY, SLOT_KEYS, type SlotKey } from '@goodboy/core';
import type { AgentRole, ContextSlot } from '@goodboy/types';
import { buildContextPreamble } from '../../store/slices/turn/preamble';
import { ROLE_SLOTS, rolesReadingSlot } from './slotRouting';

const ROLES = Object.keys(ROLE_REGISTRY) as ReadonlyArray<AgentRole>;

const FULL_SLOTS: ReadonlyArray<ContextSlot> = SLOT_KEYS.map((key) => ({
  key,
  value: `${key} value for Harborline`,
  enabled: true,
}));

const preambleFor = ({ role }: { readonly role: AgentRole }) =>
  buildContextPreamble(FULL_SLOTS, ROLE_SLOTS[role]);

describe('ROLE_SLOTS', () => {
  it('has one explicit entry per role in the registry', () => {
    expect([...Object.keys(ROLE_SLOTS)].sort()).toEqual([...ROLES].sort());
    expectTypeOf(ROLE_SLOTS).toEqualTypeOf<Readonly<Record<AgentRole, ReadonlyArray<SlotKey>>>>();
  });

  it('only references valid slot keys', () => {
    const valid = new Set<string>(SLOT_KEYS);
    for (const slots of Object.values(ROLE_SLOTS)) {
      expect(slots.every((key) => valid.has(key))).toBe(true);
    }
  });

  it('gives the generalist every slot, explicitly', () => {
    expect(ROLE_SLOTS.custom).toEqual(SLOT_KEYS);
  });

  it('shows the reviewer the decisions and the scout only the goal and the last output', () => {
    expect(preambleFor({ role: 'reviewer' })).toContain('decisions value for Harborline');
    expect(preambleFor({ role: 'scout' })).not.toContain('decisions value for Harborline');
    expect(ROLE_SLOTS.scout).toEqual(['goal', 'last_output_summary']);
  });

  it('names the roles that read a slot', () => {
    expect(rolesReadingSlot({ slot: 'decisions' })).not.toContain('scout');
    expect(rolesReadingSlot({ slot: 'decisions' })).not.toContain('docs');
    expect(rolesReadingSlot({ slot: 'decisions' })).toContain('reviewer');
    expect([...rolesReadingSlot({ slot: 'last_output_summary' })].sort()).toEqual(
      ROLES.filter((role) => role !== 'resolver').sort(),
    );
  });
});
