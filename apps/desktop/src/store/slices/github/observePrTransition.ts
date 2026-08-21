import type {
  PullRequestState,
  PullRequestStateKind,
  SessionEventKind,
  SessionId,
} from '@goodboy/types';
import { prEventPayload } from './prEventPayload';
import type { GetFn } from './types';

const OBSERVED_KIND: Partial<Record<PullRequestStateKind, SessionEventKind>> = {
  approved: 'pr_approved',
  merged: 'pr_merged',
  closed: 'pr_closed',
};

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly previous: PullRequestState | null;
  readonly next: PullRequestState | null;
};

export const observePrTransition = async ({
  get,
  sessionId,
  previous,
  next,
}: Params): Promise<void> => {
  if (previous == null || next == null || previous.number !== next.number) {
    return;
  }
  if (previous.state === next.state) {
    return;
  }
  const kind = OBSERVED_KIND[next.state];
  if (kind === undefined) {
    return;
  }
  await get().recordSessionEventOnce({
    sessionId,
    kind,
    payload: prEventPayload({ number: next.number, pr: next }),
  });
};
