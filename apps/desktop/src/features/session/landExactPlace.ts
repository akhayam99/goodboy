import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { PlaceRequest } from '../../store/slices/navigation/types';
import { attentionPlace } from './attentionPlace';
import type { AttentionExactPlace } from './attentionTarget';

type PlaceParams = {
  readonly sessionId: SessionId;
  readonly place: AttentionExactPlace;
};

type LandParams = PlaceParams & {
  readonly isLatest: () => boolean;
};

type RequestTabParams = {
  readonly to: PlaceRequest;
};

type LoadParams = {
  readonly sessionId: SessionId;
};

const placeRequestOf = ({ sessionId, place }: PlaceParams): PlaceRequest =>
  attentionPlace({ state: useAppStore.getState(), sessionId, ...place });

const isRequestTab = ({ to }: RequestTabParams): boolean => {
  if (to.at !== 'session') {
    return false;
  }
  const target = to.view.target;
  return target?.kind === 'branch' && (target.tab === 'comments' || target.tab === 'checks');
};

const loadBranchData = async ({ sessionId }: LoadParams): Promise<void> => {
  const store = useAppStore.getState();
  const results = await Promise.allSettled([
    store.refreshReviewSource({ sessionId }),
    store.loadDiffComments(sessionId),
    store.loadResolveSession({ sessionId }),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') {
      void store.reportError({
        recovery: CHECK_STATE,
        title: "Couldn't load this branch before opening it",
        error: result.reason,
      });
    }
  }
};

export const landExactPlace = async ({ sessionId, place, isLatest }: LandParams): Promise<void> => {
  const workspaceId = useAppStore.getState().currentWorkspaceId;
  if (isRequestTab({ to: placeRequestOf({ sessionId, place }) })) {
    await loadBranchData({ sessionId });
  }
  const latest = useAppStore.getState();
  if (!isLatest() || latest.currentWorkspaceId !== workspaceId) {
    return;
  }
  latest.navigate({ to: placeRequestOf({ sessionId, place }) });
};
