import {
  PROVIDERS_REPORTING_LIMITS,
  providersByHeadroom,
  type HeadroomMap,
  type ProviderHeadroom,
} from '@goodboy/core';
import type { ProviderId, ProviderLimits } from '@goodboy/types';
import type { PolicyRow } from '../providers/policy/policyRows';
import { PROVIDER_LABEL } from '../providers/providerLabel';

export type RulesProviderRoom = Readonly<{
  id: ProviderId;
  name: string;
  state: PolicyRow['state'];
  reportsLimits: boolean;
  headroom: ProviderHeadroom;
  used: number | null;
}>;

type WindowParams = {
  readonly limits: ProviderLimits | undefined;
  readonly kind: 'fiveHour' | 'weekly';
};

const usedOf = ({ limits, kind }: WindowParams): number | null =>
  limits?.windows.find((window) => window.kind === kind)?.usedFraction ?? null;

const mostUsedOf = ({ limits }: Pick<WindowParams, 'limits'>): number | null => {
  const fiveHour = usedOf({ limits, kind: 'fiveHour' });
  const weekly = usedOf({ limits, kind: 'weekly' });
  return fiveHour === null && weekly === null ? null : Math.max(fiveHour ?? 0, weekly ?? 0);
};

type RoomsParams = {
  readonly rows: ReadonlyArray<PolicyRow>;
  readonly headroom: HeadroomMap;
  readonly limits: Readonly<Partial<Record<ProviderId, ProviderLimits>>>;
};

export const rulesProviderRooms = ({
  rows,
  headroom,
  limits,
}: RoomsParams): ReadonlyArray<RulesProviderRoom> =>
  rows
    .filter((row) => !row.isNew)
    .map((row) => ({
      id: row.id,
      name: PROVIDER_LABEL[row.id],
      state: row.state,
      reportsLimits: PROVIDERS_REPORTING_LIMITS.includes(row.id),
      headroom: headroom[row.id] ?? 'unknown',
      used: mostUsedOf({ limits: limits[row.id] }),
    }));

export const canSpreadByHeadroom = ({
  rooms,
}: {
  readonly rooms: ReadonlyArray<RulesProviderRoom>;
}): boolean => rooms.some((room) => room.state === 'on' && room.reportsLimits);

type PickParams = {
  readonly rooms: ReadonlyArray<RulesProviderRoom>;
  readonly spread: boolean;
};

type RulesPickReason =
  | Readonly<{ kind: 'first-in-order' }>
  | Readonly<{ kind: 'most-room' }>
  | Readonly<{ kind: 'passed-tight'; passed: string; used: number }>
  | Readonly<{ kind: 'passed-out'; passed: string }>;

export type RulesPick = Readonly<{ name: string; reason: RulesPickReason }>;

export const nextStepPick = ({ rooms, spread }: PickParams): RulesPick | null => {
  const on = rooms.filter((room) => room.state === 'on');
  const first = on[0];
  if (first === undefined) {
    return null;
  }
  if (!spread) {
    return { name: first.name, reason: { kind: 'first-in-order' } };
  }
  const headroom = Object.fromEntries(on.map((room) => [room.id, room.headroom]));
  const order = providersByHeadroom({ providers: on.map((room) => room.id), headroom });
  const picked = on.find((room) => room.id === order[0]) ?? first;
  const passed = on.find(
    (room) => room !== picked && on.indexOf(room) < on.indexOf(picked) && room.headroom !== 'ok',
  );
  if (passed === undefined) {
    return { name: picked.name, reason: { kind: 'most-room' } };
  }
  return passed.headroom === 'out'
    ? { name: picked.name, reason: { kind: 'passed-out', passed: passed.name } }
    : {
        name: picked.name,
        reason: { kind: 'passed-tight', passed: passed.name, used: passed.used ?? 0 },
      };
};
