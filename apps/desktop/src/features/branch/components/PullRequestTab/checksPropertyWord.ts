import type { PrCheckRun, PullRequestChecksRead } from '@goodboy/types';
import { checksGroupsOf } from '../../../integrations/github/checksRollup';

type ChecksPropertyTone = 'success' | 'danger' | 'info' | 'neutral';

export type ChecksPropertyWord = {
  readonly text: string;
  readonly tone: ChecksPropertyTone;
};

type Params = {
  readonly read: PullRequestChecksRead;
  readonly runs: ReadonlyArray<PrCheckRun>;
};

export const checksPropertyWord = ({ read, runs }: Params): ChecksPropertyWord => {
  if (read !== 'ok') {
    return { text: 'Checks unknown', tone: 'neutral' };
  }
  if (runs.length === 0) {
    return { text: 'No checks', tone: 'neutral' };
  }
  const groups = checksGroupsOf({ checks: runs });
  const count = (group: string): number =>
    groups.find((entry) => entry.group === group)?.runs.length ?? 0;
  const failing = count('failing');
  const running = count('running');
  const passed = count('passed') + count('skipped');
  if (failing > 0) {
    return {
      text: [`${failing} failing`, ...(passed > 0 ? [`${passed} passed`] : [])].join(', '),
      tone: 'danger',
    };
  }
  if (running > 0) {
    return {
      text: [...(passed > 0 ? [`${passed} passed`] : []), `${running} running`].join(', '),
      tone: 'info',
    };
  }
  return { text: `All ${runs.length} passed`, tone: 'success' };
};
