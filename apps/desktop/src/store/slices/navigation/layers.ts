import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { sessionPlace } from './place';
import type { LayerKind, Location, NavigationStack, Place, PlaceRequest } from './types';

const STRUCTURAL_PARENT: Partial<Record<LayerKind, LayerKind>> = { history: 'diff' };

export const layerKindOf = (place: Place): LayerKind | null => {
  if (place.at !== 'session' || place.view.studio !== null) {
    return null;
  }
  const { lens, target, agentId } = place.view;
  if (lens === 'review') {
    return 'review';
  }
  if (agentId !== null) {
    return null;
  }
  if (lens === 'pr') {
    return 'pr';
  }
  if (lens === 'files') {
    return target?.kind === 'diff' && target.page === 'history' ? 'history' : 'diff';
  }
  return null;
};

const isOverviewOf = (place: Place, sessionId: SessionId): boolean =>
  place.at === 'session' &&
  place.sessionId === sessionId &&
  place.view.lens === null &&
  place.view.agentId === null &&
  place.view.studio === null;

const sessionOf = (place: Place): SessionId | null =>
  place.at === 'session' ? place.sessionId : null;

const sameLayers = (
  left: ReadonlyArray<LayerKind> | undefined,
  right: ReadonlyArray<LayerKind>,
): boolean => {
  const kinds = left ?? [];
  return kinds.length === right.length && kinds.every((kind, index) => kind === right[index]);
};

const trailOf = ({
  layers = [],
  kind,
}: {
  readonly layers?: ReadonlyArray<LayerKind>;
  readonly kind: LayerKind;
}) => {
  const parent = STRUCTURAL_PARENT[kind];
  return parent === undefined ? [...layers, kind] : [...layers, parent, kind];
};

type CanonicalParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly kind: LayerKind;
};

const canonicalLayers = ({ state, sessionId, kind }: CanonicalParams): ReadonlyArray<LayerKind> =>
  kind === 'review' && (state.sessionGithub[sessionId]?.pr ?? null) !== null ? ['pr'] : [];

const hasFocus = (request: PlaceRequest): boolean => {
  if (request.at !== 'session') {
    return true;
  }
  const { target } = request.view;
  if (target === null) {
    return false;
  }
  return target.kind !== 'diff' || target.focus !== null;
};

export type LayerMove =
  | { readonly kind: 'none' }
  | { readonly kind: 'push'; readonly layers: ReadonlyArray<LayerKind> }
  | { readonly kind: 'pop'; readonly index: number };

type MoveParams = {
  readonly state: AppState;
  readonly stack: NavigationStack;
  readonly request: PlaceRequest;
  readonly place: Place;
};

const findBelow = ({
  stack,
  sessionId,
  kind,
  layers,
}: {
  readonly stack: NavigationStack;
  readonly sessionId: SessionId;
  readonly kind: LayerKind;
  readonly layers: ReadonlyArray<LayerKind>;
}): number | null => {
  for (let index = stack.index - 1; index >= 0; index -= 1) {
    const entry = stack.entries[index];
    if (entry === undefined || entry.studio !== null || sessionOf(entry.place) !== sessionId) {
      return null;
    }
    if (layerKindOf(entry.place) === kind && sameLayers(entry.layers, layers)) {
      return index;
    }
  }
  return null;
};

export const layerMove = ({ state, stack, request, place }: MoveParams): LayerMove => {
  const kind = layerKindOf(place);
  const sessionId = sessionOf(place);
  if (kind === null || sessionId === null) {
    return { kind: 'none' };
  }
  const top: Location | undefined = stack.entries[stack.index];
  const topKind =
    top === undefined || top.studio !== null || sessionOf(top.place) !== sessionId
      ? null
      : layerKindOf(top.place);
  if (top === undefined || topKind === null) {
    const isInside = top !== undefined && top.studio === null && isOverviewOf(top.place, sessionId);
    return {
      kind: 'push',
      layers: isInside ? [] : canonicalLayers({ state, sessionId, kind }),
    };
  }
  if (kind === topKind) {
    return { kind: 'push', layers: top.layers ?? [] };
  }
  const trail = trailOf({ ...(top.layers !== undefined && { layers: top.layers }), kind: topKind });
  const parent = STRUCTURAL_PARENT[kind];
  const at = trail.indexOf(kind);
  if (at >= 0) {
    const layers = trail.slice(0, at);
    const below = hasFocus(request) ? null : findBelow({ stack, sessionId, kind, layers });
    return below === null ? { kind: 'push', layers } : { kind: 'pop', index: below };
  }
  if (parent !== undefined) {
    const parentAt = trail.indexOf(parent);
    if (parentAt >= 0) {
      return { kind: 'push', layers: trail.slice(0, parentAt) };
    }
  }
  return { kind: 'push', layers: trail };
};

type SyncParams = {
  readonly top: Location;
  readonly live: Location;
};

export const carryLayers = ({ top, live }: SyncParams): Location => {
  if (top.layers === undefined || top.layers.length === 0) {
    return live;
  }
  const kind = layerKindOf(live.place);
  return kind !== null &&
    kind === layerKindOf(top.place) &&
    sessionOf(live.place) === sessionOf(top.place)
    ? { ...live, layers: top.layers }
    : live;
};

type PlaceParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly kind: LayerKind;
};

export const layerPlace = ({ state, sessionId, kind }: PlaceParams): Place => {
  if (kind === 'pr' || kind === 'review') {
    return sessionPlace({ sessionId, lens: kind });
  }
  return sessionPlace({
    sessionId,
    lens: 'files',
    target: {
      kind: 'diff',
      mountPath: state.diffMountPath[sessionId] ?? null,
      focus: null,
      ...(kind === 'history' && { page: 'history' as const }),
    },
  });
};

type ChainParams = {
  readonly state: AppState;
  readonly location: Location | undefined;
};

export const layerChain = ({ state, location }: ChainParams): ReadonlyArray<Place> => {
  if (location === undefined) {
    return [];
  }
  const sessionId = sessionOf(location.place);
  if (sessionId === null || layerKindOf(location.place) === null) {
    return [];
  }
  return [
    ...(location.layers ?? []).map((kind) => layerPlace({ state, sessionId, kind })),
    location.place,
  ];
};
