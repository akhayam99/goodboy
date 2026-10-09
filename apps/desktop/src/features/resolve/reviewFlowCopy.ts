import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { NAMES } from '../../shared/names';
import type { ReviewComposeMode } from '../review/reviewRequest';

export const REVIEW_FLOW_LABEL = {
  list: 'Comments',
  comment: 'Comment',
  proposedChange: 'Proposed change',
  resolver: 'Resolver',
  edited: 'Edited',
  commentEdited: 'Comment edited',
  lineMoved: 'The line moved',
  resolveOnly: 'Resolve only',
  editReply: 'Edit the reply',
  saveReply: 'Save reply',
  cancel: 'Cancel',
  keysHint: 'Esc cancels',
  noChangeCaptured: 'The agent changed no code for this comment.',
  tooLarge: 'The change is too large to show here.',
} as const;

export const sourceChangeLine = ({
  author,
  time,
}: {
  readonly author: string | null;
  readonly time: string;
}): string => {
  const by = author === null ? 'Edited' : `Edited by ${author}`;
  return time === '' ? `${by}, after the draft.` : `${by}, seen at ${time}, after the draft.`;
};

export const newReplyLine = ({ authors }: { readonly authors: ReadonlyArray<string> }): string => {
  const [first, second] = authors;
  if (first === undefined) {
    return 'New reply';
  }
  if (second === undefined) {
    return `New reply from ${first}`;
  }
  return `New replies from ${authors.join(', ')}`;
};

export const replyHeading = ({ author }: { readonly author: string | null }): string =>
  author === null ? 'Reply' : `Reply to ${author}`;

export const COMPOSE_COPY: Record<
  ReviewComposeMode,
  { readonly label: string; readonly submit: string; readonly placeholder: string }
> = {
  edit: {
    label: 'What should change',
    submit: 'Send to the agent',
    placeholder: 'Tell the agent what to do differently',
  },
  redraft: {
    label: 'What should change this time',
    submit: 'Redraft',
    placeholder: 'Leave it empty to let the agent read the comment again',
  },
  answer: {
    label: 'Your answer',
    submit: 'Send answer',
    placeholder: 'Answer the agent, it drafts again with it',
  },
  fixAnyway: {
    label: 'What the fix should do',
    submit: 'Fix it anyway',
    placeholder: 'Optional. Say what the change should be',
  },
  rewrite: {
    label: 'How the reply should change',
    submit: 'Rewrite the reply',
    placeholder: 'Optional. Say what the reply should say instead',
  },
  reply: {
    label: 'Your reply',
    submit: 'Reply without a change',
    placeholder: 'The reviewer reads this on GitHub after the push',
  },
};

export const composePlaceholder = ({
  mode,
  provider,
}: {
  readonly mode: ReviewComposeMode;
  readonly provider: string;
}): string =>
  mode === 'reply'
    ? `The reviewer reads this on ${provider} after the push`
    : COMPOSE_COPY[mode].placeholder;

const sentToHost = ({
  provider,
  sha,
  canResolve,
}: {
  readonly provider: string;
  readonly sha: string | null;
  readonly canResolve: boolean;
}): string => {
  const where = sha === null ? provider : `${provider} in ${sha.slice(0, 7)}`;
  return canResolve ? `Sent to ${where} and the thread is resolved.` : `Sent to ${where}.`;
};

export const decidedNote = ({
  state,
  sha,
  provider = REVIEW_SOURCE_LABEL.github,
  canResolve = true,
}: {
  readonly state: 'accepted' | 'replied' | 'skipped' | 'pushed' | 'resolved';
  readonly sha: string | null;
  readonly provider?: string;
  readonly canResolve?: boolean;
}): string => {
  switch (state) {
    case 'accepted':
      return 'Accepted. It goes out with the next push.';
    case 'replied':
      return 'Reply only. It goes out with the next push. No code change.';
    case 'skipped':
      return `Left open on ${provider}. You skipped it. The thread stays open there.`;
    case 'pushed':
      return sentToHost({ provider, sha, canResolve });
    case 'resolved':
      return `Resolved on ${provider} by someone else.`;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

export const REPLY_NOTE_COPY = {
  alone: 'Reply only. Nothing else is waiting to push, so it can go out now.',
  posting: 'Posting the reply',
  posted: ({ provider }: { readonly provider: string }): string => `Replied on ${provider}.`,
  postNow: NAMES.publishReply,
  retry: 'Retry',
} as const;

export const sharedFixLine = ({ count }: { readonly count: number }): string =>
  count === 1
    ? 'The same fix answers one more comment, accepted with this one:'
    : `The same fix answers ${count} more comments, accepted with this one:`;

export const FIX_RUN_QUESTION_COPY = {
  title: 'Question from the fix run',
  options: 'Answer',
  other: 'Or tell it something else',
  continue: 'Continue the fix run',
  hint: 'Continues the same run, in the same copy of the branch.',
  answered: 'You answered:',
} as const;

export const FIX_RUN_THREAD_COPY = {
  working: 'Working on it',
  sameRun: 'Same fix run',
  retry: 'Retry in this run',
  startOver: 'Start over with a new agent',
  retryHint:
    'Retry keeps the same run and the same copy of the branch. Start over begins a new agent.',
} as const;

export const FIX_RUN_COPY = {
  didHeading: 'What it did',
  fromReply: 'from the last reply',
  commitsHeading: 'Commits',
  threadsHeading: ({ count }: { readonly count: number }): string =>
    count === 1 ? 'Covers 1 comment' : `Covers ${count} comments`,
  openBatch: 'Open them in Comments',
  openBatchNotes: 'Open them in Notes',
  noCommit: 'No commits yet',
  statusWorking: 'Working',
  statusQueued: 'Queued',
  statusWaiting: 'Waiting for you',
  gone: 'This comment is no longer on the branch.',
  comment: 'Comment',
  commit: 'Commit',
  rewritten: 'no longer on this branch, it was squashed or rewritten',
  foldedInto: ({ sha }: { readonly sha: string }): string => `Folded into ${sha.slice(0, 7)}`,
  batch: ({ others }: { readonly others: number }): string =>
    `Fixed together with ${others} more ${others === 1 ? 'comment' : 'comments'}.`,
} as const;

export const RECHECK_LABEL = {
  running: 'Re-checking',
  looking: 'Looking for the change on the branch…',
  result: 'Re-check result',
  checked: 'Checked',
  alreadyPosted: 'The reply is already on the pull request, so there is nothing to post.',
  runsOn: ({ model }: { readonly model: string }): string => `Fix again runs on ${model}.`,
} as const;
