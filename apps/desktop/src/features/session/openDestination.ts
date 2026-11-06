import type { SessionId } from '@goodboy/types';
import type { LensDestination } from './lens-destinations';
import { openLens } from './openLens';
import { openToolPane } from './panes/openToolPane';

type Params = {
  readonly sessionId: SessionId;
  readonly destination: LensDestination;
};

export const openDestination = ({ sessionId, destination }: Params): void => {
  if (destination.pane !== undefined) {
    openToolPane({ sessionId, pane: destination.pane });
    return;
  }
  openLens({ sessionId, lens: destination.lens ?? null });
};
