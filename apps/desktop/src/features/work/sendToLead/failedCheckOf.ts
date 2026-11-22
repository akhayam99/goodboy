import type { PrCheckConclusion, PrCheckRun } from '@goodboy/types';
import type { MountGithubState } from '../../../store/types';

const FAILED: ReadonlySet<PrCheckConclusion> = new Set<PrCheckConclusion>([
  'failure',
  'timed_out',
  'action_required',
]);

type Params = {
  readonly github: MountGithubState | undefined;
};

export const failedCheckOf = ({ github }: Params): PrCheckRun | null =>
  (github?.detail?.checks ?? []).find((check) => FAILED.has(check.conclusion)) ?? null;
