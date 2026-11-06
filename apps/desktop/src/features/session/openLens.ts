import type { SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../store';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';
import { linkIssueEventName } from '../actions/kinds/session';
import { isProviderListLens } from '../../store/slices/navigation/isProviderListLens';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';

type Params = Readonly<{
  sessionId: SessionId;
  lens: LensKind | null;
}>;

export const openLens = ({ sessionId, lens }: Params): void => {
  const state = useAppStore.getState();
  if (isProviderListLens({ lens })) {
    state.navigate({ to: lensPlace({ state, sessionId, lens: null }) });
    dispatchAfterNavigation({ name: linkIssueEventName({ sessionId }) });
    return;
  }
  state.navigate({ to: lensPlace({ state, sessionId, lens }) });
};
