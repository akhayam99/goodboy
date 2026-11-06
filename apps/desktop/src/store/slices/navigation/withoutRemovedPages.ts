import type { SessionId } from '@goodboy/types';
import { IPHONE_SETTINGS_PLACE } from '../../../features/settings/iphoneSettingsPlace';
import type { OpenDrawer } from '../drawer/state';
import type { StudioPlace } from './studio';
import type { Location, SessionTarget } from './types';

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

const REMOVED_LENSES: ReadonlySet<string> = new Set(['terminal', 'explore', 'scripts']);

const REMOVED_TARGETS: ReadonlySet<string> = new Set(['terminal', 'explore', 'scripts', 'agent']);

const REMOVED_STUDIOS: ReadonlyMap<string, StudioPlace> = new Map<string, StudioPlace>([
  ['companion', IPHONE_SETTINGS_PLACE],
]);

const paneOfLens = ({ lens, sessionId }: PaneParams): OpenDrawer | null => {
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

const withoutRemovedLens = ({ location }: Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const { view } = place;
  const lens = String(view.lens);
  const hasRemovedLens = REMOVED_LENSES.has(lens);
  const target = hasRemovedLens ? null : targetStillThere({ target: view.target });
  if (!hasRemovedLens && target === view.target) {
    return location;
  }
  const pane = hasRemovedLens ? paneOfLens({ lens, sessionId: place.sessionId }) : null;
  return {
    ...location,
    place: {
      ...place,
      view: { ...view, lens: hasRemovedLens ? null : view.lens, target },
    },
    focus: { ...location.focus, drawer: location.focus.drawer ?? pane },
  };
};

const withoutRailLevel = ({ location }: Params): Location => {
  const { place } = location;
  if (place.at !== 'session' || location.focus.drawer !== null) {
    return location;
  }
  const isRunShown = place.view.target?.kind === 'run';
  const isAutoShown = place.view.lens === 'auto' && place.view.agentId !== null;
  if (!isRunShown && !isAutoShown) {
    return location;
  }
  return {
    ...location,
    focus: {
      ...location.focus,
      drawer: { kind: 'spawned', sessionId: place.sessionId, payload: null },
    },
  };
};

export const withoutRemovedPages = ({ location }: Params): Location =>
  withoutRailLevel({
    location: withoutRemovedLens({ location: withoutRemovedStudio({ location }) }),
  });
