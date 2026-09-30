import type { PullRequestStateKind } from '@goodboy/types';
import type { InboxState } from './types';

type Params = {
  readonly kind: PullRequestStateKind;
};

export const requestInboxState = ({ kind }: Params): InboxState => {
  if (kind === 'merged' || kind === 'closed') {
    return 'done';
  }
  return kind === 'queued' ? 'active' : 'open';
};
