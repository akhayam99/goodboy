import type { SessionId } from '@goodboy/types';
import { IPHONE_SETTINGS_PLACE } from '../../../features/settings/iphoneSettingsPlace';
import type { OpenDrawer } from '../drawer/state';
import type { StudioPlace } from './studio';
import type { Location } from './types';

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

const REMOVED_LENSES: ReadonlySet<string> = new Set(['terminal', 'explore', 'scripts']);

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

const withoutRemovedLens = ({ location }: Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const { view } = place;
  const lens = String(view.lens);
  const hasRemovedLens = REMOVED_LENSES.has(lens);
  const hasRemovedTarget = REMOVED_LENSES.has(String(view.target?.kind));
  if (!hasRemovedLens && !hasRemovedTarget) {
    return location;
  }
  const pane = hasRemovedLens ? paneOfLens({ lens, sessionId: place.sessionId }) : null;
  return {
    ...location,
    place: {
      ...place,
      view: {
        ...view,
        lens: hasRemovedLens ? null : view.lens,
        target: hasRemovedLens || hasRemovedTarget ? null : view.target,
      },
    },
    focus: { ...location.focus, drawer: location.focus.drawer ?? pane },
  };
};

export const withoutRemovedPages = ({ location }: Params): Location =>
  withoutRemovedLens({ location: withoutRemovedStudio({ location }) });
