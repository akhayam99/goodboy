export const MAX_STARTS_PER_DAY = 10;

export const MAX_GOAL_LENGTH = 2000;

const DAY_MS = 86_400_000;

const sequences = new Map<string, number>();
let startedAt: number[] = [];
let trainSequence = 0;

type WorkspaceParams = {
  readonly workspaceId: string;
};

export const startSequenceOf = ({ workspaceId }: WorkspaceParams): string =>
  String(sequences.get(workspaceId) ?? 0);

type NowParams = {
  readonly now: number;
};

export const startsLeftToday = ({ now }: NowParams): number =>
  Math.max(0, MAX_STARTS_PER_DAY - startedAt.filter((at) => at > now - DAY_MS).length);

type RecordParams = WorkspaceParams & NowParams;

export const recordStart = ({ workspaceId, now }: RecordParams): void => {
  sequences.set(workspaceId, (sequences.get(workspaceId) ?? 0) + 1);
  startedAt = [...startedAt.filter((at) => at > now - DAY_MS), now];
};

export const trainSequenceOf = (): string => String(trainSequence);

export const bumpTrainSequence = (): void => {
  trainSequence += 1;
};

export const clearStartState = (): void => {
  sequences.clear();
  startedAt = [];
  trainSequence = 0;
};
