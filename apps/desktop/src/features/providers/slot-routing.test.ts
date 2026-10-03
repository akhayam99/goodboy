// @vitest-environment node
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ROLE_REGISTRY, SLOT_KEYS, type SlotKey } from '@goodboy/core';
import type { AgentRole, ContextSlot } from '@goodboy/types';
import { buildContextPreamble } from '../../store/slices/turn/preamble';
import { kindForRole } from '../session/agent-kind';
import { LEGACY_KIND_SLOTS, ROLE_SLOTS, rolesReadingSlot, slotsForTurn } from './slot-routing';

const ROLES = Object.keys(ROLE_REGISTRY) as ReadonlyArray<AgentRole>;

const FULL_SLOTS: ReadonlyArray<ContextSlot> = SLOT_KEYS.map((key) => ({
  key,
  value: `${key} value for Harborline`,
  enabled: true,
}));

const preambleFor = ({
  role,
  isRoleMapOn,
}: {
  readonly role: AgentRole;
  readonly isRoleMapOn: boolean;
}) =>
  buildContextPreamble(
    FULL_SLOTS,
    slotsForTurn({ role, kind: kindForRole({ role }), isRoleMapOn }),
  );

const GAINS_DECISIONS: ReadonlyArray<AgentRole> = ['reviewer', 'investigator', 'resolver'];

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

  it.each(ROLES.filter((role) => !GAINS_DECISIONS.includes(role)))(
    'gives %s the same prompt it got from the kind map',
    (role) => {
      expect(preambleFor({ role, isRoleMapOn: true })).toBe(
        preambleFor({ role, isRoleMapOn: false }),
      );
    },
  );

  it.each(GAINS_DECISIONS)('adds decisions to %s and changes nothing else', (role) => {
    const before = slotsForTurn({ role, kind: kindForRole({ role }), isRoleMapOn: false }) ?? [];
    const after = ROLE_SLOTS[role];

    expect(before).not.toContain('decisions');
    expect([...after].sort()).toEqual([...before, 'decisions'].sort());
    expect(preambleFor({ role, isRoleMapOn: true })).toContain('decisions value for Harborline');
    expect(preambleFor({ role, isRoleMapOn: false })).not.toContain(
      'decisions value for Harborline',
    );
  });

  it('gives the generalist every slot, explicitly', () => {
    expect(ROLE_SLOTS.custom).toEqual(SLOT_KEYS);
    expect(slotsForTurn({ role: 'custom', kind: 'generic', isRoleMapOn: true })).toEqual(SLOT_KEYS);
  });

  it('gives a PR review turn the reviewer slots, keyed by role', () => {
    expect(slotsForTurn({ role: 'reviewer', kind: 'pr-reviewer', isRoleMapOn: true })).toEqual(
      ROLE_SLOTS.reviewer,
    );
  });

  it('falls back to the kind map with the switch off', () => {
    expect(slotsForTurn({ role: 'reviewer', kind: 'reviewer', isRoleMapOn: false })).toEqual(
      LEGACY_KIND_SLOTS.reviewer,
    );
    expect(slotsForTurn({ role: 'custom', kind: 'generic', isRoleMapOn: false })).toBeUndefined();
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
