import { AUTO_CHILD_IDLE_MINUTES } from '@goodboy/core';

const REASON_TEXT: ReadonlyMap<string, string> = new Map([
  ['deadline_passed', 'It ran out of time.'],
  [
    'no_activity',
    `It showed no activity for ${AUTO_CHILD_IDLE_MINUTES} minutes and was stopped. Its work is kept.`,
  ],
  ['stopped', 'It was stopped.'],
  ['process_error', 'The agent ended with an error.'],
  ['no_closing_envelope', 'It ended without saying whether the work was done.'],
  ['artifact_persistence_failed', 'Its result could not be saved.'],
  ['report_missing', 'It ended without writing its report.'],
  ['declared_blocked', 'It reported that it is blocked.'],
  ['missing_tool', 'It had no shell to run the commands of the task.'],
  ['no_new_version', 'It did not write a new version.'],
  ['lost_structure', 'Its new version lost the structure of the plan.'],
  ['stale_base', 'The version it worked on is no longer the latest.'],
]);

type Params = {
  readonly reason: string | null;
};

const PROSE = /^[A-Z]/;

export const delegationReasonTextOf = ({ reason }: Params): string | null => {
  if (reason === null) {
    return null;
  }
  const known = REASON_TEXT.get(reason);
  if (known !== undefined) {
    return known;
  }
  return PROSE.test(reason) ? reason : null;
};
