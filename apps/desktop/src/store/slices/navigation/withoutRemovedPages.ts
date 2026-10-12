import type { Location } from './types';

type Params = {
  readonly location: Location;
};

const REMOVED_LENS = 'terminal';

export const withoutRemovedPages = ({ location }: Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const { view } = place;
  const hasRemovedLens = String(view.lens) === REMOVED_LENS;
  const hasRemovedTarget = String(view.target?.kind) === REMOVED_LENS;
  if (!hasRemovedLens && !hasRemovedTarget) {
    return location;
  }
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
  };
};
