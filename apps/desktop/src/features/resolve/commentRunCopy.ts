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
  startRun: 'Start a run',
  startRunNote: 'The Lead plans it first and asks you before anything is kept.',
  fixAsOne: 'Fix as one change',
  fixAsOneNote: 'One agent, one quick edit. For a small change.',
  openRun: 'Open run',
  suggestTitle: 'This asks for a rethink, not a quick fix.',
  suggestWhy: 'A run lets the Lead plan it first and asks you before anything is kept.',
  runSuggested: ({ count }: CountParams): string =>
    count === 1 ? '1 comment suggests a run' : `${count} comments suggest a run`,
} as const;
