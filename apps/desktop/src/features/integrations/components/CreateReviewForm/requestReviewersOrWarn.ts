import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { CreatedReview, RequestReviewersParams } from './types';

type WarningToast = {
  readonly kind: 'warning';
  readonly message: string;
};

type Params = {
  readonly requestReviewers: (params: RequestReviewersParams) => Promise<void>;
  readonly showToast: (toast: WarningToast) => void;
  readonly sessionId: SessionId;
  readonly created: CreatedReview;
  readonly reviewers: ReadonlyArray<string>;
};

export const requestReviewersOrWarn = async ({
  requestReviewers,
  showToast,
  sessionId,
  created,
  reviewers,
}: Params): Promise<void> => {
  if (reviewers.length === 0 || created.number === null) {
    return;
  }
  await requestReviewers({ sessionId, number: created.number, logins: reviewers }).catch(
    (error: unknown) =>
      showToast({
        kind: 'warning',
        message: `Reviewers were not requested: ${formatError(error)}`,
      }),
  );
};
