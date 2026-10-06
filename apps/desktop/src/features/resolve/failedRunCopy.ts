import { NAMES } from '../../shared/names';
import type { ResolveRowAction } from './resolveRowState';

export const FAILED_RUN_COPY = {
  retry: NAMES.retry,
  anotherModel: 'Try another model',
  addHint: 'Add a hint',
  hintLabel: 'What should the agent do differently?',
  hintKeys: '↵ sends, ⇧↵ new line, Esc cancels',
  replyYourself: 'Reply yourself',
  skip: 'Skip',
  openTranscript: 'Open transcript',
  moreActions: 'More actions',
  modelList: 'Model for a new agent',
  usedAndFailed: 'could not fix it',
  attemptsRegion: 'Previous attempts',
} as const;

export const tryAgainLabel = ({
  modelName,
  hasHint,
}: {
  readonly modelName: string | null;
  readonly hasHint: boolean;
}): string => {
  if (hasHint) {
    return `${NAMES.retry} with the hint`;
  }
  return modelName === null ? FAILED_RUN_COPY.retry : `${NAMES.retry} on ${modelName}`;
};

const ROW_ACTION_VERB: Record<ResolveRowAction, string> = {
  resolve: 'Draft a fix',
  answer: 'Answer',
  review: 'Review',
  retry: NAMES.retry,
  retry_reply: 'Post the reply again',
  open_github: 'Open on GitHub',
  resume: 'Resume',
};

export const failedVerbOf = ({ action }: { readonly action: ResolveRowAction }): string =>
  ROW_ACTION_VERB[action];

export const SYNC_COPY = {
  action: 'Sync and try again',
  confirmTitle: 'Bring the new commits in first?',
  confirmDescription:
    'This fetches origin and rebases your unpushed commits on top of it. If they conflict, nothing is touched.',
  confirmLabel: 'Sync',
  working: 'Syncing with origin',
  conflict:
    'Your unpushed commits conflict with the new ones on origin. Nothing was changed. Resolve it by hand or ask an agent.',
  noBranch: 'This session has no branch to sync.',
  movedGeneric: 'Nothing was pushed. The branch on origin moved since you reviewed.',
} as const;
