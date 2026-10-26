import type { MountId, PrSeriesId, PrSeriesView, PullRequestHost, SessionId } from '@goodboy/types';
import { mountRequestOf, type MountRowState } from '../project-mounts/mountRowModel';
import type { AppState } from '../../types';

export type SeriesPartState = 'merged' | 'closed' | 'open' | 'planned';

export type SeriesPart = Readonly<{
  ordinal: number;
  label: string;
  mountId: MountId | null;
  state: SeriesPartState;
  provider: PullRequestHost | null;
  number: number | null;
}>;

export type SeriesStrip = Readonly<{
  id: PrSeriesId;
  name: string;
  total: number;
  current: number | null;
  parts: ReadonlyArray<SeriesPart>;
}>;

type State = MountRowState & Pick<AppState, 'prSeries'>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
};

type MemberParams = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly member: PrSeriesView['members'][number];
};

const memberMountIdOf = ({ state, sessionId, member }: MemberParams): MountId | null => {
  if (member.mountId !== null) {
    return member.mountId;
  }
  if (member.branch === null) {
    return null;
  }
  const mount = (state.sessionMounts[sessionId] ?? []).find(
    (candidate) => candidate.branch === member.branch,
  );
  return mount === undefined ? null : mount.id;
};

const ENDED_STATES: Readonly<Partial<Record<string, SeriesPartState>>> = {
  merged: 'merged',
  closed: 'closed',
};

const partOf = ({ state, sessionId, member }: MemberParams): SeriesPart => {
  const mountId = memberMountIdOf({ state, sessionId, member });
  const request = mountId === null ? null : mountRequestOf({ state, mountId });
  const label = member.label;
  if (mountId === null) {
    return {
      ordinal: member.ordinal,
      label,
      mountId: null,
      state: 'planned',
      provider: null,
      number: null,
    };
  }
  if (request === null) {
    return {
      ordinal: member.ordinal,
      label,
      mountId,
      state: 'open',
      provider: null,
      number: null,
    };
  }
  const partState = ENDED_STATES[request.state] ?? 'open';
  return {
    ordinal: member.ordinal,
    label,
    mountId,
    state: partState,
    provider: request.provider,
    number: request.number,
  };
};

type StripParams = Params & {
  readonly series: PrSeriesView;
};

const stripOf = ({ state, sessionId, series }: StripParams) => {
  const members = series.members
    .filter((member) => member.status !== 'omitted')
    .sort((left, right) => left.ordinal - right.ordinal);
  const parts = members.map((member) => partOf({ state, sessionId, member }));
  const total = Math.max(series.plannedCount ?? 0, parts.length);
  const known = new Set(parts.map((part) => part.ordinal));
  for (let ordinal = 1; ordinal <= total; ordinal += 1) {
    if (!known.has(ordinal)) {
      parts.push({
        ordinal,
        label: String(ordinal),
        mountId: null,
        state: 'planned',
        provider: null,
        number: null,
      });
    }
  }
  parts.sort((left, right) => left.ordinal - right.ordinal);
  const index = parts.findIndex((part) => part.state === 'open' || part.state === 'planned');
  const strip: SeriesStrip = {
    id: series.id,
    name: series.name,
    total,
    current: index < 0 ? null : index + 1,
    parts,
  };
  return strip;
};

export const seriesStripsOf = ({ state, sessionId }: Params): ReadonlyArray<SeriesStrip> =>
  (state.prSeries[sessionId] ?? [])
    .filter((series) => series.members.some((member) => member.status !== 'omitted'))
    .map((series) => stripOf({ state, sessionId, series }));
