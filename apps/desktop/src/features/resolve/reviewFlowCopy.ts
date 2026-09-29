import type { ReviewComposeMode } from '../review/reviewRequest';

export const REVIEW_TITLE = 'Review';

export const REVIEW_FLOW_LABEL = {
  list: 'Comments',
  comment: 'Comment',
  commentActions: 'Comment actions',
  reviewActions: 'Review actions',
  proposedChange: 'Proposed change',
  fix: 'Fix',
  agentAsks: 'The agent asks',
  resolver: 'Resolver',
  edited: 'Edited',
  resolveOnly: 'Resolve only',
  editReply: 'Edit the reply',
  saveReply: 'Save reply',
  cancel: 'Cancel',
  keysHint: '↵ sends, ⇧↵ new line, Esc cancels',
  previous: 'Previous comment',
  next: 'Next comment',
  noChangeCaptured: 'The agent changed no code for this comment.',
  tooLarge: 'The change is too large to show here.',
} as const;

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
  reply: {
    label: 'Your reply',
    submit: 'Reply without a change',
    placeholder: 'The reviewer reads this on GitHub after the push',
  },
};

export const decidedNote = ({
  state,
  sha,
}: {
  readonly state: 'accepted' | 'replied' | 'skipped' | 'pushed' | 'resolved';
  readonly sha: string | null;
}): string => {
  switch (state) {
    case 'accepted':
      return 'Accepted. It goes out with the next push.';
    case 'replied':
      return 'Reply only. It goes out with the next push.';
    case 'skipped':
      return 'Skipped. It stays open on GitHub and never blocks the push.';
    case 'pushed':
      return sha === null ? 'Pushed.' : `Pushed in ${sha.slice(0, 7)}.`;
    case 'resolved':
      return 'Resolved on GitHub by someone else.';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

export const counterLabel = ({
  index,
  total,
}: {
  readonly index: number;
  readonly total: number;
}): string => `${index} of ${total}`;

export const sharedFixLine = ({ count }: { readonly count: number }): string =>
  count === 1
    ? 'The same fix answers one more comment, accepted with this one:'
    : `The same fix answers ${count} more comments, accepted with this one:`;

export const RESOLVER_BRIEF_COPY = {
  pushNow: 'Push now',
  openInReview: 'Open in Review',
  openTranscript: 'Open transcript',
} as const;

export const batchChildNotice = ({ total }: { readonly total: number }): string => {
  const others = total - 1;
  return `This comment was fixed with ${others} ${others === 1 ? 'other' : 'others'}. Accept and push them together in Review.`;
};
