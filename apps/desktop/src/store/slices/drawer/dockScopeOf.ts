import type { Place } from '../navigation/types';
import type { DockScope } from './dockScopeState';

type Params = {
  readonly place: Place;
};

export const dockScopeOf = ({ place }: Params): DockScope =>
  place.at === 'session' ? place.sessionId : null;
