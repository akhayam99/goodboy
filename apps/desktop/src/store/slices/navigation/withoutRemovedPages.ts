import { isProviderListLens } from './isProviderListLens';
import { contextSectionOf } from './contextSectionOf';
import { brandId, type AgentId, type SessionId, type WorkflowRunId } from '@goodboy/types';
import { IPHONE_SETTINGS_PLACE } from '../../../features/settings/iphoneSettingsPlace';
import type { OpenDrawer } from '../drawer/state';
import type { LensKind } from '../session-view/types';
import { sessionPlace } from './place';
import type { StudioPlace } from './studio';
import type { Location, Place, SessionTarget } from './types';

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

const REMOVED_STUDIOS: ReadonlyMap<string, StudioPlace> = new Map<string, StudioPlace>([
  ['companion', IPHONE_SETTINGS_PLACE],
]);

const paneOfLens = ({ lens, sessionId }: PaneParams): OpenDrawer | null => {
  const section = contextSectionOf({ lens });
  if (section !== null) {
    return { kind: 'context', sessionId, payload: { section: section, view: 'current' } };
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

type LensParams = {
  readonly lens: LensKind | null;
};

type DrawerParams = {
  readonly drawer: OpenDrawer | null;
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
    place: {
      ...place,
      view: { ...view, lens: nextLens, target },
    },
    focus: { ...location.focus, drawer: location.focus.drawer ?? pane },
  };
};

const pageOfRemovedDrawer = ({ drawer }: DrawerParams): Place | null => {
  if (drawer === null || !REMOVED_DRAWERS.has(String(drawer.kind))) {
    return null;
  }
  const { sessionId } = drawer;
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

const withoutFormerSection = ({ location }: Params): Location => {
  const drawer = location.focus.drawer;
  if (drawer?.kind !== 'context') {
    return location;
  }
  const current: unknown = Reflect.get(drawer.payload, 'section');
  const former: unknown = Reflect.get(drawer.payload, 'tab');
  const value = current ?? former;
  const section = value === 'learned' ? 'explanations' : value;
  if (
    section !== 'goal' &&
    section !== 'decisions' &&
    section !== 'summary' &&
    section !== 'explanations'
  ) {
    return location;
  }
  if (current === section) {
    return location;
  }
  return {
    ...location,
    focus: {
      ...location.focus,
      drawer: {
        ...drawer,
        payload: {
          section,
          view: drawer.payload.view,
          ...(drawer.payload.highlight === undefined
            ? {}
            : { highlight: drawer.payload.highlight }),
        },
      },
    },
  };
};

export const withoutRemovedPages = ({ location }: Params): Location =>
  withoutRemovedLens({
    location: withoutFormerSection({
      location: withoutRemovedDrawer({ location: withoutRemovedStudio({ location }) }),
    }),
  });
