type CountParams = {
  readonly count: number;
};

type PlaceParams = {
  readonly place: string;
};

export const COMMENT_RUN_COPY = {
  label: 'Start a run from this comment',
  goal: 'Goal',
  goalHint: 'Goal, written from the comment. Edit it as you like.',
  goalHintMany: ({ count }: CountParams): string =>
    `Goal, written from the ${count} comments. Edit it as you like.`,
  sources: 'The run reads these comments word for word',
  more: 'Add another comment from this branch',
  add: ({ place }: PlaceParams): string => `Add ${place} to the run`,
  remove: ({ place }: PlaceParams): string => `Remove ${place} from the run`,
  general: 'Whole change',
  cancel: 'Cancel',
  localNote: 'Nothing leaves this machine.',
  hostNote: 'Nothing is posted until the run pushes and you allow it.',
  inRun: 'This comment is already in a run.',
  fixing: 'A fix is already working on this comment.',
  note: 'Note',
} as const;
