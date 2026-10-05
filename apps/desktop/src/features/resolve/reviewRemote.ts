import type { WorkNodeState } from '@goodboy/ui';
import type { ResolveVerdict, ResolveVerdictKind } from '@goodboy/types';
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
}): ThreadRemoteKind | null => {
  const remote = remoteKindOf({ facts });
  if (remote === null) {
    return null;
  }
  if (state === 'pushed') {
    return remote === 'missing' && facts?.missing?.wasPushed === true ? remote : null;
  }
  return IGNORED_STATES.has(state) ? null : remote;
};

export type RemoteTone = 'success' | 'warning' | 'info' | 'muted';

export type RemoteView = {
  readonly word: string;
  readonly node: WorkNodeState;
  readonly tone: RemoteTone;
};

const REMOTE_VIEW: Record<ThreadRemoteKind, RemoteView> = {
  on_origin: { word: 'Already on origin', node: 'done', tone: 'success' },
  looks_fixed: { word: 'Looks fixed', node: 'done', tone: 'success' },
  you_replied: { word: 'You replied', node: 'done', tone: 'success' },
  folded: { word: 'Folded in', node: 'done', tone: 'success' },
  missing: { word: 'Fix went missing', node: 'stopped', tone: 'warning' },
};

export const VERDICT_VIEW: Record<ResolveVerdictKind, RemoteView> = {
  fixed_elsewhere: { word: 'Already fixed here', node: 'done', tone: 'success' },
  obsolete: { word: 'No longer relevant', node: 'closed', tone: 'muted' },
  refix: { word: 'Still needed', node: 'stopped', tone: 'warning' },
};

const CHECKING_VIEW: RemoteView = { word: 'Checking', node: 'running', tone: 'info' };

export const remoteViewOf = ({
  remote,
  verdict,
  isChecking,
}: {
  readonly remote: ThreadRemoteKind;
  readonly verdict: ResolveVerdict | null;
  readonly isChecking: boolean;
}): RemoteView => {
  if (remote !== 'missing') {
    return REMOTE_VIEW[remote];
  }
  if (isChecking) {
    return CHECKING_VIEW;
  }
  return verdict === null ? REMOTE_VIEW.missing : VERDICT_VIEW[verdict.kind];
};

export const remoteActionLabel = ({
  action,
  canResolve,
}: {
  readonly action: 'replyAndResolve' | 'closeWithReply';
  readonly canResolve: boolean;
}): string => {
  if (action === 'replyAndResolve') {
    return canResolve ? REMOTE_LABEL.replyAndResolve : REMOTE_LABEL.replyOnly;
  }
  return canResolve ? REMOTE_LABEL.closeWithReply : REMOTE_LABEL.postThisReply;
};

export const REMOTE_LABEL = {
  evidence: 'What git says',
  replyAndResolve: 'Reply and resolve',
  replyOnly: 'Reply',
  resolveOnly: 'Resolve only',
  fixAnyway: 'Fix anyway',
  recheck: 'Re-check',
  pushToReply: 'Push to reply',
  lookAgain: 'Look again',
  fixAgain: 'Fix again',
  addHint: 'Add a hint',
  closeWithReply: 'Close with this reply',
  postThisReply: 'Post this reply',
  openCommit: 'Open commit',
  foldedNotPushed: 'It is on this branch and goes out with the next push.',
  nothingToPush: 'Nothing to push for this one.',
  nothingToPost: 'Goodboy posts nothing here.',
} as const;

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
