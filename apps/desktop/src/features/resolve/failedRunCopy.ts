import type { ResolveFailedStep, ResolveRowAction } from './resolveRowState';

export const FAILED_RUN_COPY = {
  tryAgain: 'Try again',
  anotherModel: 'Try another model',
  addHint: 'Add a hint',
  hintLabel: 'What should the agent do differently?',
  hintKeys: '↵ sends, ⇧↵ new line, Esc cancels',
  replyYourself: 'Reply yourself',
  skip: 'Skip',
  openTranscript: 'Open transcript',
  moreActions: 'More actions',
  modelList: 'Model for the next attempt',
  usedAndFailed: 'failed on this',
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
    return 'Try again with the hint';
  }
  return modelName === null ? FAILED_RUN_COPY.tryAgain : `Try again on ${modelName}`;
};

const ROW_ACTION_VERB: Record<ResolveRowAction, string> = {
  resolve: 'Draft a fix',
  answer: 'Answer',
  review: 'Review',
  retry: 'Try again',
  retry_reply: 'Post the reply again',
  open_github: 'Open on GitHub',
  resume: 'Resume',
};

export const failedVerbOf = ({
  step,
  action,
}: {
  readonly step: ResolveFailedStep;
  readonly action: ResolveRowAction;
}): string => {
  if (step === 'push' && action === 'retry') {
    return 'Push again';
  }
  return ROW_ACTION_VERB[action];
};

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
