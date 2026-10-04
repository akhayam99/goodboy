import { SLOT_KEYS, type SlotKey } from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';
import { ROLE_SLOTS } from '../../../providers/slot-routing';
import { ROLE_LABEL } from '../../agent-kind';

export type VisibilityChip = {
  readonly key: string;
  readonly label: string;
  readonly isReading: boolean;
};

export type Visibility = {
  readonly summary: string;
  readonly hasYou: boolean;
  readonly chips: ReadonlyArray<VisibilityChip>;
  readonly note: string;
};

const SINGLE_ORDER: ReadonlyArray<AgentRole> = [
  'planner',
  'implementer',
  'investigator',
  'reviewer',
  'scout',
  'docs',
  'resolver',
];

const GROUP_ORDER: ReadonlyArray<AgentRole> = [
  'custom',
  'tester',
  'report',
  'scribe',
  'wireframe',
  'rewriter',
];

const GROUP_SHOWN = 3;

const readsEverything = ({ role }: { readonly role: AgentRole }): boolean =>
  SLOT_KEYS.every((slot) => ROLE_SLOTS[role].includes(slot));

const ALL_ROLES = Object.keys(ROLE_SLOTS) as ReadonlyArray<AgentRole>;

const GROUPED: ReadonlyArray<AgentRole> = [
  ...GROUP_ORDER.filter((role) => readsEverything({ role })),
  ...ALL_ROLES.filter(
    (role) =>
      !GROUP_ORDER.includes(role) && !SINGLE_ORDER.includes(role) && readsEverything({ role }),
  ),
];

const SINGLES: ReadonlyArray<AgentRole> = [
  ...SINGLE_ORDER,
  ...ALL_ROLES.filter((role) => !SINGLE_ORDER.includes(role) && !GROUPED.includes(role)),
];

const groupLabel = (): string => {
  const shown = GROUPED.slice(0, GROUP_SHOWN).map((role) => ROLE_LABEL[role]);
  const rest = GROUPED.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} +${rest}` : shown.join(', ');
};

const chipsFor = ({ slot }: { readonly slot: SlotKey | null }): ReadonlyArray<VisibilityChip> => [
  ...SINGLES.map((role) => ({
    key: role,
    label: ROLE_LABEL[role],
    isReading: slot !== null && ROLE_SLOTS[role].includes(slot),
  })),
  ...(GROUPED.length === 0
    ? []
    : [{ key: 'everything', label: groupLabel(), isReading: slot !== null }]),
];

export const slotVisibility = ({ slot }: { readonly slot: SlotKey }): Visibility => {
  const chips = chipsFor({ slot });
  const left = chips.filter((chip) => !chip.isReading).map((chip) => chip.label);
  return {
    summary: left.length === 0 ? 'All roles' : `All roles except ${left.join(', ')}`,
    hasYou: false,
    chips,
    note: 'Agents only.',
  };
};

export const youOnlyVisibility = (): Visibility => ({
  summary: 'You only',
  hasYou: true,
  chips: chipsFor({ slot: null }),
  note: 'You only.',
});
