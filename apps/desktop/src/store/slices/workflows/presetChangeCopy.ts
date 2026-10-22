import type { PlanChangeKind, PlanChangeRequest } from '@goodboy/types';

type ChangeParams = {
  readonly change: PlanChangeRequest;
};

const ASKED: Readonly<Record<PlanChangeKind, (step: string) => string>> = {
  added: (step) => `Auto wants to add ${step}, which the preset does not have`,
  skipped: (step) => `Auto wants to skip ${step}`,
  reordered: (step) => `Auto wants to move ${step} earlier`,
};

export const PRESET_CHANGE_COPY = {
  tag: {
    added: 'Added',
    skipped: 'Skipped',
    reordered: 'Moved',
  },
  why: {
    added: 'Added to the preset',
    skipped: 'Skipped from the preset',
    reordered: 'Moved in the preset',
  },
  apply: {
    added: 'Add it',
    skipped: 'Skip it',
    reordered: 'Move it',
  },
  decline: {
    added: 'Skip',
    skipped: 'Keep it',
    reordered: 'Keep the order',
  },
  keep: 'Keep the preset',
  switchToAdapt: 'Switch to adapt',
  asked: ({ change }: ChangeParams): string =>
    change.reason === ''
      ? ASKED[change.kind](change.step)
      : `${ASKED[change.kind](change.step)}: ${change.reason}`,
  pinned: ({ change }: ChangeParams): string =>
    `${change.step} is pinned, so it runs as written. Auto asked: ${change.reason}`,
  approvedHint: ({ change }: ChangeParams): string =>
    `The operator approved this change to the preset: ${change.kind} ${change.step}. Make it now.`,
  declinedHint: ({ change }: ChangeParams): string =>
    `The operator keeps the preset as written: do not make the change ${change.kind} ${change.step}. Go on with the preset.`,
  failed: "Couldn't answer the preset question",
} as const;
