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

type VerbParams = {
  readonly verb: string;
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
  startRun: 'Start a run',
  startRunNote: 'The Lead plans it first and asks you before anything is kept.',
  fixAsOne: 'Fix as one change',
  fixAsOneNote: 'One agent, one quick edit. For a small change.',
  openRun: 'Open run',
  suggestTitle: 'This asks for a rethink, not a quick fix.',
  suggestWhy: 'A run lets the Lead plan it first and asks you before anything is kept.',
  runSuggested: ({ count }: CountParams): string =>
    count === 1 ? '1 comment suggests a run' : `${count} comments suggest a run`,
  localNoteSource: 'A local note',
  hostSource: ({ label }: LabelParams): string => `A ${label} comment`,
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
  unavailable: "This comment isn't loaded here. Open the branch to see it.",
  addedMessage: 'One more comment for this run. Work it into the plan, without starting over.',
  runEnded: "The run ended, so the comment wasn't added.",
  notSaved: "The message to the run couldn't be saved, so the comment wasn't added.",
  finished: 'Run finished',
  resolveNote: 'Resolve note',
  keepOpen: 'Keep open',
  reopen: 'Reopen',
  hostVerb: ({ verb, label }: VerbParams): string => `${verb} on ${label}`,
  whatRunDid: 'What the run did',
  keptWithNote: 'from the Lead, kept with the note',
  reply: 'Reply',
  draftedReply: ({ label }: LabelParams): string =>
    `drafted by the Lead, posted on ${label} when you press it`,
  noSummary: 'The run left no summary. Open run to read what it did.',
  noReply: 'Write the reply first.',
  stoppedTitle: 'The run stopped. Nothing was resolved.',
  stoppedBody: 'The comment is open again. The run keeps its plan and its transcript.',
  resolvedByRun: ({ title }: TitleParams): string => `Resolved by the run ${title}`,
  notPushed: "The run's commits aren't on origin yet, so nothing was posted. Push them first.",
  statusUnread: "Goodboy couldn't read the branch, so nothing was posted. Try again.",
  changedTitle: 'The comment changed after the run started.',
  changedBody: 'The run still works from the text it started with.',
  sendChange: 'Send the new text to the run',
  keepRunAsIs: 'Keep the run as it is',
  changedMessage: 'The reviewer edited this comment. Here is the new text; weigh it in the plan.',
  changeSent: ({ title }: TitleParams): string => `New text sent to the run ${title}`,
  changeNotSaved: "The message to the run couldn't be saved. The comment change is still here.",
} as const;
