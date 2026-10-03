import { providersByHeadroom, type HeadroomMap, type ProviderHeadroom } from '@goodboy/core';
import type { ProviderId, ProviderLimits } from '@goodboy/types';
import type { PolicyRow } from '../providers/policy/policyRows';
import { PROVIDER_LABEL } from '../providers/providerLabel';

export type RulesProviderRoom = Readonly<{
  id: ProviderId;
  name: string;
  stateLabel: string;
  headroom: ProviderHeadroom;
  fiveHour: number | null;
  weekly: number | null;
}>;

const STATE_LABEL: Readonly<Record<PolicyRow['state'], string>> = {
  on: 'On',
  backup: 'Backup only',
  off: 'Off',
};

type WindowParams = {
  readonly limits: ProviderLimits | undefined;
  readonly kind: 'fiveHour' | 'weekly';
};

const usedOf = ({ limits, kind }: WindowParams): number | null =>
  limits?.windows.find((window) => window.kind === kind)?.usedFraction ?? null;

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
      stateLabel: STATE_LABEL[row.state],
      headroom: headroom[row.id] ?? 'unknown',
      fiveHour: usedOf({ limits: limits[row.id], kind: 'fiveHour' }),
      weekly: usedOf({ limits: limits[row.id], kind: 'weekly' }),
    }));

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

const mostUsed = (room: RulesProviderRoom): number =>
  Math.max(room.fiveHour ?? 0, room.weekly ?? 0);

export const roomUsedText = (room: RulesProviderRoom): string => percent(mostUsed(room));

type PickParams = {
  readonly rooms: ReadonlyArray<RulesProviderRoom>;
  readonly spread: boolean;
};

export type RulesPick = Readonly<{ name: string; why: string }>;

export const nextStepPick = ({ rooms, spread }: PickParams): RulesPick | null => {
  const on = rooms.filter((room) => room.stateLabel === 'On');
  const first = on[0];
  if (first === undefined) {
    return null;
  }
  if (!spread) {
    return { name: first.name, why: 'First in your order.' };
  }
  const headroom = Object.fromEntries(on.map((room) => [room.id, room.headroom]));
  const order = providersByHeadroom({ providers: on.map((room) => room.id), headroom });
  const picked = on.find((room) => room.id === order[0]) ?? first;
  const passed = on.find(
    (room) => room !== picked && on.indexOf(room) < on.indexOf(picked) && room.headroom !== 'ok',
  );
  if (passed === undefined) {
    return { name: picked.name, why: 'It has the most room left.' };
  }
  return passed.headroom === 'out'
    ? { name: picked.name, why: `${passed.name} is at its limit, so it gets no new work.` }
    : { name: picked.name, why: `${passed.name} is at ${roomUsedText(passed)}, so it goes last.` };
};

export const spreadSuggestion = ({
  rooms,
}: {
  readonly rooms: ReadonlyArray<RulesProviderRoom>;
}) => {
  const on = rooms.filter((room) => room.stateLabel === 'On');
  const tight = on.find((room) => mostUsed(room) >= 0.8);
  const roomy = on.find(
    (room) => room !== tight && room.headroom !== 'tight' && room.headroom !== 'out',
  );
  if (tight === undefined || roomy === undefined) {
    return null;
  }
  return `${tight.name} is at ${roomUsedText(tight)} used. Spreading would send new steps to ${roomy.name} first while ${tight.name} is tight.`;
};
