import type { SessionId } from '@goodboy/types';
import type { OpenDrawer } from '../drawer/state';
import type { Location } from './types';

type Params = {
  readonly location: Location;
};

type PaneParams = {
  readonly lens: string;
  readonly sessionId: SessionId;
};

const REMOVED_LENSES: ReadonlySet<string> = new Set(['terminal', 'explore', 'scripts']);

const paneOfLens = ({ lens, sessionId }: PaneParams): OpenDrawer | null => {
  if (lens === 'explore') {
    return { kind: 'explore', sessionId, payload: null };
  }
  if (lens === 'scripts') {
    return { kind: 'scripts', sessionId, payload: null };
  }
  return null;
};

export const withoutRemovedPages = ({ location }: Params): Location => {
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
