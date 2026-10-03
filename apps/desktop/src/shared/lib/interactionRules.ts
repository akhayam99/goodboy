import type { ButtonVariant } from '@goodboy/ui';

type ActionVerb = {
  readonly verb: string;
  readonly meaning: string;
  readonly variant: ButtonVariant | null;
};

export const ACTION_VERBS: ReadonlyArray<ActionVerb> = [
  { verb: 'Done', meaning: 'Finish an edit in place', variant: 'secondary' },
  { verb: 'Close', meaning: 'Leave a panel', variant: 'ghost' },
  { verb: 'Dismiss', meaning: 'Hide a notice', variant: 'ghost' },
  { verb: 'Discard', meaning: 'Abandon an unsaved draft', variant: 'ghost' },
  { verb: 'Delete', meaning: 'Remove an object', variant: null },
];

export const CHOICE_SEGMENT_LIMIT = 4;

export const CHOICE_OVERFLOW_LABEL = 'More';
