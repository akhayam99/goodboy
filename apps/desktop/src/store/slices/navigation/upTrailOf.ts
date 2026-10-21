import type { TrailSegmentModel } from '@goodboy/ui';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import type { AppState } from '../../types';
import { crumbOf } from './crumbOf';
import { locationKey } from './locationKey';
import { parentPlace } from './parentPlace';
import type { Place } from './types';

type UpParams = {
  readonly to: Place;
};

type Params = {
  readonly state: AppState;
  readonly place: Place;
  readonly onUp: (params: UpParams) => void;
};

type ChainParams = {
  readonly state: AppState;
  readonly place: Place;
  readonly depth: number;
};

const DEPTH_LIMIT = 8;

const UP_SHORTCUT: ShortcutId = 'nav.up';

const chainOf = ({ state, place, depth }: ChainParams): ReadonlyArray<Place> => {
  const parent = depth < DEPTH_LIMIT ? parentPlace({ state, place }) : null;
  if (parent === null || parent.at !== 'session') {
    return [place];
  }
  return [...chainOf({ state, place: parent, depth: depth + 1 }), place];
};

export const upTrailOf = ({ state, place, onUp }: Params): ReadonlyArray<TrailSegmentModel> => {
  const chain = chainOf({ state, place, depth: 1 });
  return chain.map((step, index) => {
    const crumb = crumbOf({ state, place: step });
    const isCurrent = index === chain.length - 1;
    const isParent = index === chain.length - 2;
    return {
      id: locationKey({ place: step }),
      label: crumb.label,
      icon: crumb.icon,
      ...(isCurrent ? {} : { onSelect: () => onUp({ to: step }) }),
      ...(isParent ? { tooltip: `Go up to ${crumb.label}`, shortcut: UP_SHORTCUT } : {}),
    };
  });
};
