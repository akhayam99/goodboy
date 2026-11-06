import type { SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../store';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';
import { linkIssueEventName } from '../actions/kinds/session';
import { providerOfListLens } from '../../store/slices/navigation/providerOfListLens';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';

type Params = Readonly<{
  sessionId: SessionId;
  lens: LensKind | null;
}>;

export const openLens = ({ sessionId, lens }: Params): void => {
  const state = useAppStore.getState();
  const source = providerOfListLens({ lens });
  if (source !== null) {
    state.navigate({ to: lensPlace({ state, sessionId, lens: null }) });
    dispatchAfterNavigation({ name: linkIssueEventName({ sessionId }), detail: { source } });
    return;
  }
  state.navigate({ to: lensPlace({ state, sessionId, lens }) });
};
