import { formatError } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import { activeReviewSourceOf } from '../review-source/activeReviewSource';
import { pullRequestPortFor } from '../review-source/pullRequestPortFor';
import type { PullRequestViewEntry } from './state';
import type { GetFn, LoadPullRequestViewParams, SetFn } from './types';

const VIEW_TTL_MS = 60_000;

type Params = LoadPullRequestViewParams & {
  readonly set: SetFn;
  readonly get: GetFn;
};

const stamp = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

export const loadPullRequestView = async ({
  set,
  get,
  sessionId,
  mountId,
  force = false,
}: Params): Promise<void> => {
  const number =
    get().sessionGithub?.[sessionId]?.pr?.number ??
    activeReviewSourceOf({ state: get(), sessionId })?.prNumber ??
    null;
  if (number === null) {
    return;
  }
  const current = get().pullRequestViews[sessionId];
  const same = current !== undefined && current.prNumber === number ? current : null;
  if (same !== null) {
    const age =
      same.fetchedAt === null ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(same.fetchedAt);
    if (same.isLoading || (!force && same.view !== null && age < VIEW_TTL_MS)) {
      return;
    }
  }
  const port = pullRequestPortFor({
    get,
    sessionId,
    prNumber: number,
    ...(mountId === undefined ? {} : { mountId }),
  });
  if (port === null) {
    return;
  }
  const patch = (entry: PullRequestViewEntry): void =>
    set((state) => ({ pullRequestViews: { ...state.pullRequestViews, [sessionId]: entry } }));
  patch({
    prNumber: number,
    view: same?.view ?? null,
    isLoading: true,
    error: null,
    fetchedAt: same?.fetchedAt ?? null,
    edits: same?.edits ?? [],
  });
  try {
    const view = await port.read();
    patch({
      prNumber: number,
      view,
      isLoading: false,
      error: null,
      fetchedAt: stamp(),
      edits: same?.edits ?? [],
    });
  } catch (error) {
    patch({
      prNumber: number,
      view: same?.view ?? null,
      isLoading: false,
      error: formatError(error),
      fetchedAt: same?.fetchedAt ?? null,
      edits: same?.edits ?? [],
    });
  }
};
