import type { SessionId } from '@goodboy/types';
import { prWriteContext } from './prWriteContext';
import { runPortWrite } from './runPortWrite';
import type { PrWriteOptions } from './prWriteOptions';
import type { GetFn, SetFn } from './types';

const REQUEST_REVIEW_FAILURE_TITLE = "Couldn't request a review";

export const requestReview = (_set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    prNumber: number,
    reviewers: ReadonlyArray<string>,
    { mountId }: PrWriteOptions = {},
  ) => {
    const logins = reviewers.map((r) => r.trim()).filter(Boolean);
    if (logins.length === 0) {
      return;
    }
    const { session, port } = prWriteContext({
      get,
      sessionId,
      prNumber,
      ...(mountId === undefined ? {} : { mountId }),
      failureTitle: () => REQUEST_REVIEW_FAILURE_TITLE,
    });

    await runPortWrite({
      get,
      sessionId,
      workspaceId: session.workspaceId,
      title: REQUEST_REVIEW_FAILURE_TITLE,
      run: () => port.requestReviewers({ logins }),
    });
    await get().refreshSessionPrDetail(sessionId, {
      force: true,
      ...(mountId === undefined ? {} : { mountId }),
    });
  };
};
