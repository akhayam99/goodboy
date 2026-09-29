import { selectActiveMountId } from '../project-mounts/selectors';
import { reviewSourceEntriesOf } from './reviewSourceEntries';
import { refreshGitlabReviewThreads } from './refreshGitlabReviewThreads';
import type { GetFn, SelectReviewSourceParams, SetFn } from './types';

type Params = SelectReviewSourceParams & {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const selectReviewSource = async ({ set, get, sessionId, key }: Params): Promise<void> => {
  const entry = reviewSourceEntriesOf({ state: get(), sessionId }).find(
    (candidate) => candidate.key === key,
  );
  if (entry === undefined) {
    return;
  }
  const activeMountId = selectActiveMountId({ state: get(), sessionId });
  if (entry.mountId !== null && entry.mountId !== activeMountId) {
    await get().setSessionActiveMount({ sessionId, mountId: entry.mountId });
  }
  if (entry.kind === 'github' && entry.mountId !== null && entry.number !== null) {
    await get().selectSessionPr(sessionId, entry.number, entry.mountId);
  }
  set((state) => ({ reviewSourceKeys: { ...state.reviewSourceKeys, [sessionId]: key } }));
  if (entry.kind === 'gitlab') {
    await refreshGitlabReviewThreads({ set, get, sessionId, force: true, silent: true });
  }
};
