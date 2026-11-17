type CountParams = {
  readonly count: number;
};

type PlaceParams = {
  readonly place: string;
};

type TitleParams = {
  readonly title: string;
};

type LabelParams = {
  readonly label: string;
};

type HostParams = {
  readonly label: string | null;
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
  localNoteSource: 'A local note',
  hostSource: ({ label }: LabelParams): string => `A ${label} comment`,
  openRun: 'Open run',
  openComment: 'Open comment',
  runLine: ({ title }: TitleParams): string => `Run: ${title}`,
  inThisRun: ({ count }: CountParams): string =>
    count === 1 ? '1 comment in this run' : `${count} comments in this run`,
  workingLocal: 'Your note stays open while the run works. Nothing is posted anywhere.',
  workingHost: 'Nothing is posted while the run works. A reply waits for the push you allow.',
  fromComments: ({ count }: CountParams): string =>
    count === 1 ? 'From 1 comment' : `From ${count} comments`,
  quotedWord: ({ count }: CountParams): string =>
    count === 1 ? 'The goal quotes it word for word' : 'The goal quotes them word for word',
  fromComment: 'From comment',
  stillOpen: 'Still open',
  resolvedOn: ({ label }: HostParams): string =>
    label === null ? 'Resolved' : `Resolved on ${label}`,
  unavailable: 'This comment is not loaded here. Open the branch to see it.',
  addToRun: 'Add to the run',
  addToRunNamed: ({ title }: TitleParams): string => `Add to the run ${title}`,
  added: ({ title }: TitleParams): string => `Added to the run ${title}`,
  addedMessage: 'One more comment for this run. Work it into the plan, without starting over.',
  runEnded: 'The run ended, so the comment was not added.',
  notSaved: "The message to the run couldn't be saved, so the comment was not added.",
} as const;
