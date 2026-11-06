import type { NavigationLocation } from '../../../../store';
import type { AppState } from '../../../../store/types';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { STUDIO_META } from '../../StudioFrame/studioMeta';
import { placeTitleOf } from '../../../../store/slices/navigation/placeTitleOf';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

export type HistoryLabel = {
  readonly label: string;
  readonly context: string | null;
};

type Params = {
  readonly location: NavigationLocation;
  readonly state: AppState;
};

export const historyLabel = ({ location, state }: Params): HistoryLabel => {
  if (location.studio !== null) {
    return { label: STUDIO_META[location.studio.kind].title, context: null };
  }
  const { place } = location;
  const { title } = placeTitleOf({ state, place });
  if (place.at !== 'session') {
    return { label: title, context: null };
  }
  const session = sessionById(state.sessions, place.sessionId) ?? null;
  return { label: title, context: session === null ? null : sessionTitle({ session }) };
};
