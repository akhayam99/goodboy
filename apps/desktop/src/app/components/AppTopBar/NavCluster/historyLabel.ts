import type { Session } from '@goodboy/types';
import type { NavigationLocation } from '../../../../store';
import { LENS_LABEL } from '../../../../features/session/lens-labels';
import { sessionTitle } from '../../../../features/session/sessionTitle';
import { STUDIO_META } from '../../StudioFrame/studioMeta';

export type HistoryLabel = {
  readonly label: string;
  readonly context: string | null;
};

type Params = {
  readonly location: NavigationLocation;
  readonly sessions: ReadonlyArray<Session>;
};

export const historyLabel = ({ location, sessions }: Params): HistoryLabel => {
  if (location.studio !== null) {
    return { label: STUDIO_META[location.studio.kind].title, context: null };
  }
  const { place } = location;
  if (place.at === 'board') {
    return { label: 'Board', context: null };
  }
  const session = sessions.find((candidate) => candidate.id === place.sessionId) ?? null;
  const lens = place.view.lens;
  return {
    label: lens === null ? 'Overview' : LENS_LABEL[lens],
    context: session === null ? null : sessionTitle({ session }),
  };
};
