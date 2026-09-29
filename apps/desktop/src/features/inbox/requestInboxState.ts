import type { PullRequestStateKind } from '@goodboy/types';
import type { InboxState } from './types';

type Params = {
  readonly kind: PullRequestStateKind;
};

export const requestInboxState = ({ kind }: Params): InboxState =>
  kind === 'merged' || kind === 'closed' ? 'done' : 'open';
