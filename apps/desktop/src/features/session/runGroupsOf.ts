import { NAMES } from '../../shared/utils/names';
import type { SessionRun } from './sessionRunsOf';

export type RunGroupKey = 'needsYou' | 'running' | 'idle' | 'finished' | 'archived';

export type RunGroup = Readonly<{
  key: RunGroupKey;
  label: string;
  runs: ReadonlyArray<SessionRun>;
}>;

const GROUPS: ReadonlyArray<Pick<RunGroup, 'key' | 'label'>> = [
  { key: 'needsYou', label: NAMES.needsYou },
  { key: 'running', label: NAMES.running },
  { key: 'idle', label: 'Idle' },
  { key: 'finished', label: 'Finished' },
];

type RunParams = {
  readonly run: SessionRun;
};

export const runGroupKeyOf = ({ run }: RunParams): RunGroupKey => {
  if (run.isArchived) {
    return 'archived';
  }
  if (run.isFinished) {
    return 'finished';
  }
  if (run.dot === 'needsYou' || run.dot === 'failed') {
    return 'needsYou';
  }
  return run.dot === 'running' ? 'running' : 'idle';
};

type Params = {
  readonly runs: ReadonlyArray<SessionRun>;
};

export const runGroupsOf = ({ runs }: Params): ReadonlyArray<RunGroup> =>
  GROUPS.map(({ key, label }) => ({
    key,
    label,
    runs: runs.filter((run) => runGroupKeyOf({ run }) === key),
  })).filter((group) => group.runs.length > 0);
