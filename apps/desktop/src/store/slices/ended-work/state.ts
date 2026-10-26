export const SETTING_ENDED_WORK = 'restart.ended_work';
export const SETTING_ENDED_WORK_SEEN = 'restart.ended_work_seen';

export type EndedScript = {
  readonly scriptId: string;
  readonly sessionId: string;
  readonly name: string;
  readonly cwd: string;
};

export type EndedWork = {
  readonly at: number;
  readonly terminals: Readonly<Record<string, string>>;
  readonly scripts: ReadonlyArray<EndedScript>;
};

export type EndedWorkState = {
  readonly endedWork: EndedWork | null;
};

export const endedWorkInitialState: EndedWorkState = {
  endedWork: null,
};
