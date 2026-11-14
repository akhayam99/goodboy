import { brandId, type AgentId, type SessionId, type WorkflowRunId } from '@goodboy/types';
import type { OpenDrawer } from '../../drawer/state';
import type { LensKind } from '../../session-view/types';
import type { StudioPlace } from '../studio';
import type { Location, Place, SessionTarget } from '../types';

type Params = {
  readonly location: Location;
};

type PaneParams = {
  readonly lens: string;
  readonly sessionId: SessionId;
};

type StudioParams = {
  readonly studio: StudioPlace | null;
};

type TargetParams = {
  readonly target: SessionTarget | null;
};

type LensParams = {
  readonly lens: LensKind | null;
};

type DrawerParams = {
  readonly drawer: OpenDrawer | null;
};

type SectionParams = {
  readonly lens: string;
};

const PROVIDER_LIST_LENSES: ReadonlySet<string> = new Set([
  'linear',
  'gitlab_issues',
  'jira_issues',
  'slack_threads',
]);

const REMOVED_LENSES: ReadonlySet<string> = new Set([
  'terminal',
  'explore',
  'scripts',
  'context',
  'goal',
  'decisions',
  'last_output_summary',
]);

const RETIRED_RUNS_LENSES: ReadonlySet<string> = new Set(['agents', 'auto']);

const REMOVED_TARGETS: ReadonlySet<string> = new Set(['terminal', 'explore', 'scripts', 'agent']);

const REMOVED_DRAWERS: ReadonlySet<string> = new Set(['auto-child', 'run-step']);

const IPHONE_SETTINGS: StudioPlace = {
  kind: 'settings',
  focus: { scope: 'app', section: 'iphone' },
};

const REMOVED_STUDIOS: ReadonlyMap<string, StudioPlace> = new Map<string, StudioPlace>([
  ['companion', IPHONE_SETTINGS],
]);

const PREVIOUS_RELEASE_LENSES: ReadonlySet<string> = new Set([
  'questions',
  'workflows',
  'orchestrated',
  'review',
  'plans',
  'pr',
  'branch',
  'files',
  'linear',
  'gitlab_issues',
  'jira_issues',
  'github_issue',
  'slack_threads',
]);

const PREVIOUS_RELEASE_TARGETS: ReadonlySet<string> = new Set([
  'artifact',
  'run',
  'github-issue',
  'external-task',
  'diff',
  'branch',
  'thread',
  'question',
]);

const PREVIOUS_RELEASE_DRAWERS: ReadonlySet<string> = new Set([
  'check-analysis',
  'context',
  'explore-file',
  'artifact',
  'artifact-document',
  'plan-part',
  'scriptRun',
  'explore',
  'scripts',
  'conversation',
  'ask',
  'question',
  'new',
  'transcript',
  'spawned',
  'session-log',
  'fix-comments',
  'terminal',
  'browser',
  'history-versions',
  'file-diff',
  'identifier-peek',
]);

const isProviderListLens = ({ lens }: SectionParams): boolean => PROVIDER_LIST_LENSES.has(lens);

const contextSectionOf = ({ lens }: SectionParams): string | null => {
  if (lens === 'context' || lens === 'goal') {
    return 'goal';
  }
  if (lens === 'decisions') {
    return 'decisions';
  }
  if (lens === 'last_output_summary') {
    return 'summary';
  }
  return null;
};

type PlaceParams = {
  readonly sessionId: SessionId;
  readonly lens?: LensKind | null;
  readonly agentId?: AgentId | null;
  readonly target?: SessionTarget | null;
};

const sessionPlace = ({
  sessionId,
  lens = null,
  agentId = null,
  target = null,
}: PlaceParams): Place => ({
  at: 'session',
  sessionId,
  view: { lens: lens === 'orchestrated' ? 'workflows' : lens, agentId, target },
});

const paneOfLens = ({ lens, sessionId }: PaneParams): OpenDrawer | null => {
  const section = contextSectionOf({ lens });
  if (section === 'goal' || section === 'decisions' || section === 'summary') {
    return { kind: 'context', sessionId, payload: { section, view: 'current' } };
  }
  if (lens === 'explore') {
    return { kind: 'explore', sessionId, payload: null };
  }
  if (lens === 'scripts') {
    return { kind: 'scripts', sessionId, payload: null };
  }
  return null;
};

const studioStillThere = ({ studio }: StudioParams): StudioPlace | null => {
  if (studio === null) {
    return null;
  }
  return REMOVED_STUDIOS.get(String(studio.kind)) ?? studio;
};

const withoutRemovedStudio = ({ location }: Params): Location => {
  const studio = studioStillThere({ studio: location.studio });
  return studio === location.studio ? location : { ...location, studio };
};

const targetStillThere = ({ target }: TargetParams): SessionTarget | null => {
  if (target === null || REMOVED_TARGETS.has(String(target.kind))) {
    return null;
  }
  if (target.kind === 'thread' && 'pane' in target) {
    return { kind: 'thread', threadId: target.threadId };
  }
  return target;
};

const lensStillThere = ({ lens }: LensParams): LensKind | null => {
  const name = String(lens);
  if (REMOVED_LENSES.has(name)) {
    return null;
  }
  return RETIRED_RUNS_LENSES.has(name) ? 'workflows' : lens;
};

const withoutRemovedLens = ({ location }: Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const { view } = place;
  const lens = String(view.lens);
  const isProviderList = isProviderListLens({ lens }) && view.target === null;
  const hasRemovedLens = REMOVED_LENSES.has(lens) || isProviderList;
  const nextLens = isProviderList ? null : lensStillThere({ lens: view.lens });
  const target = hasRemovedLens ? null : targetStillThere({ target: view.target });
  if (nextLens === view.lens && target === view.target) {
    return location;
  }
  const pane = hasRemovedLens ? paneOfLens({ lens, sessionId: place.sessionId }) : null;
  return {
    ...location,
    place: { ...place, view: { ...view, lens: nextLens, target } },
    focus: { ...location.focus, drawer: location.focus.drawer ?? pane },
  };
};

const pageOfRemovedDrawer = ({ drawer }: DrawerParams): Place | null => {
  if (drawer === null || !REMOVED_DRAWERS.has(String(drawer.kind))) {
    return null;
  }
  const { sessionId } = drawer;
  if (sessionId === null) {
    return null;
  }
  const saved: object | null = drawer.payload;
  if (saved === null || !('agentId' in saved) || typeof saved.agentId !== 'string') {
    return sessionPlace({ sessionId });
  }
  const agentId = brandId<AgentId>({ value: saved.agentId });
  if (!('runId' in saved) || typeof saved.runId !== 'string') {
    return sessionPlace({ sessionId, lens: 'workflows', agentId });
  }
  const runId = brandId<WorkflowRunId>({ value: saved.runId });
  return sessionPlace({ sessionId, lens: 'workflows', agentId, target: { kind: 'run', runId } });
};

const withoutRemovedDrawer = ({ location }: Params): Location => {
  const place = pageOfRemovedDrawer({ drawer: location.focus.drawer });
  return place === null
    ? location
    : { ...location, place, focus: { ...location.focus, drawer: null } };
};

const previousReleaseFold = ({ location }: Params): Location =>
  withoutRemovedLens({
    location: withoutRemovedDrawer({ location: withoutRemovedStudio({ location }) }),
  });

export const opensInPreviousRelease = ({ location }: Params): boolean => {
  const folded = previousReleaseFold({ location });
  const drawer = folded.focus.drawer;
  if (drawer !== null && !PREVIOUS_RELEASE_DRAWERS.has(String(drawer.kind))) {
    return false;
  }
  if (folded.place.at !== 'session') {
    return true;
  }
  const { lens, target } = folded.place.view;
  const isKnownLens = lens === null || PREVIOUS_RELEASE_LENSES.has(String(lens));
  return isKnownLens && (target === null || PREVIOUS_RELEASE_TARGETS.has(String(target.kind)));
};
