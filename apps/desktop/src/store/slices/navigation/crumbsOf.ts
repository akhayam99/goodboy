import { NAMES } from '../../../shared/utils/names';
import type { AppState } from '../../types';
import { selectMountForPath } from '../project-mounts/selectors';
import { doorMountPath } from './doorMountPath';
import { isTabView } from './isTabView';
import { parentPlace } from './parentPlace';
import { sessionPlace } from './place';
import { placeTitleOf } from './placeTitleOf';
import type { Place, SessionView } from './types';

export type Crumb = {
  readonly key: string;
  readonly label: string;
  readonly place: Place;
};

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

type ViewParams = {
  readonly view: SessionView;
};

type SessionPlace = Extract<Place, { readonly at: 'session' }>;

type SessionPlaceParams = {
  readonly state: AppState;
  readonly place: SessionPlace;
};

const MAX_DEPTH = 8;

const isOverviewView = ({ view }: ViewParams): boolean =>
  view.agentId === null && view.target === null && view.lens === null;

const crumbKeyOf = ({ view }: ViewParams): string => {
  if (view.agentId !== null) {
    return `agent:${view.agentId}`;
  }
  const { target } = view;
  if (target === null) {
    return `lens:${view.lens ?? ''}`;
  }
  if (target.kind === 'artifact') {
    return `artifact:${target.artifactId}`;
  }
  if (target.kind === 'run') {
    return `run:${target.runId}`;
  }
  if (target.kind === 'branch' || target.kind === 'diff') {
    return `${target.kind}:${target.mountPath ?? ''}`;
  }
  return `${view.lens ?? ''}:${target.kind}`;
};

const branchLabelOf = ({ state, place }: SessionPlaceParams): string => {
  const { sessionId, view } = place;
  const mountPath =
    view.target?.kind === 'branch' && view.target.mountPath !== null
      ? view.target.mountPath
      : doorMountPath({ state, sessionId });
  const branch = selectMountForPath({ state, sessionId, path: mountPath })?.branch ?? null;
  return branch === null || branch.trim() === '' ? NAMES.branch : branch;
};

const crumbLabelOf = ({ state, place }: SessionPlaceParams): string => {
  const { sessionId, view } = place;
  if (isOverviewView({ view })) {
    return NAMES.overview;
  }
  if (view.agentId === null && view.target?.kind === 'artifact') {
    const { artifactId } = view.target;
    const artifact = (state.sessionArtifacts[sessionId] ?? []).find(
      (candidate) => candidate.id === artifactId,
    );
    return artifact?.title ?? 'Artifact';
  }
  if (view.agentId === null && view.target?.kind === 'branch') {
    return branchLabelOf({ state, place });
  }
  return placeTitleOf({ state, place }).title;
};

const chainOf = ({ state, place }: SessionPlaceParams): ReadonlyArray<SessionPlace> => {
  const chain: Array<SessionPlace> = [place];
  let current: Place | null = parentPlace({ state, place });
  while (
    current !== null &&
    current.at === 'session' &&
    current.sessionId === place.sessionId &&
    chain.length < MAX_DEPTH
  ) {
    chain.unshift(current);
    current = parentPlace({ state, place: current });
  }
  const top = chain[0];
  if (top === undefined || isOverviewView({ view: top.view })) {
    return chain;
  }
  const overview = sessionPlace({ sessionId: place.sessionId });
  return overview.at === 'session' ? [overview, ...chain] : chain;
};

export const crumbsOf = ({ state, place }: Params): ReadonlyArray<Crumb> => {
  if (place.at !== 'session' || isTabView({ view: place.view })) {
    return [];
  }
  const crumbs: Array<Crumb> = [];
  for (const step of chainOf({ state, place })) {
    const key = crumbKeyOf({ view: step.view });
    if (crumbs[crumbs.length - 1]?.key === key) {
      continue;
    }
    crumbs.push({ key, label: crumbLabelOf({ state, place: step }), place: step });
  }
  return crumbs;
};
