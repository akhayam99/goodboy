import type { WorkNodeState } from '@goodboy/ui';
import {
  remoteKindOf,
  type ThreadGitFacts,
  type ThreadRemoteKind,
} from '../../store/slices/resolve/threadGitState';
import type { ReviewCommentState } from './reviewCommentState';

const IGNORED_STATES: ReadonlySet<ReviewCommentState> = new Set([
  'drafting',
  'skipped',
  'pushed',
  'resolved',
]);

export const remoteOf = ({
  state,
  facts,
}: {
  readonly state: ReviewCommentState;
  readonly facts: ThreadGitFacts | null | undefined;
}): ThreadRemoteKind | null => (IGNORED_STATES.has(state) ? null : remoteKindOf({ facts }));

export const REMOTE_WORD: Record<ThreadRemoteKind, string> = {
  on_origin: 'Already on origin',
  looks_fixed: 'Looks fixed',
  you_replied: 'You replied',
  missing: 'Fix went missing',
};

export const REMOTE_NODE: Record<ThreadRemoteKind, WorkNodeState> = {
  on_origin: 'done',
  looks_fixed: 'done',
  you_replied: 'done',
  missing: 'stopped',
};

export const REMOTE_LABEL = {
  evidence: 'What git says',
  replyAndResolve: 'Reply and resolve',
  resolveOnly: 'Resolve only',
  fixAnyway: 'Fix anyway',
  openCommit: 'Open commit',
  nothingToPush: 'Nothing to push for this one.',
  nothingToPost: 'Goodboy posts nothing here.',
} as const;

export const replyOnlyLine = ({ count }: { readonly count: number }): string =>
  count === 1 ? '1 more needs only a reply' : `${count} more need only a reply`;

export const commitUrlOf = ({
  prUrl,
  sha,
}: {
  readonly prUrl: string | null;
  readonly sha: string;
}): string | null => {
  const match = /^(https:\/\/[^/]+\/[^/]+\/[^/]+)\/pull\/\d+/.exec(prUrl ?? '');
  return match === null ? null : `${match[1]}/commit/${sha}`;
};
