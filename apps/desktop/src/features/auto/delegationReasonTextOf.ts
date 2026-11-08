import { AUTO_CHILD_IDLE_MINUTES } from '@goodboy/core/auto';

const REASON_TEXT: ReadonlyMap<string, string> = new Map([
  ['deadline_passed', 'It ran out of time.'],
  [
    'no_activity',
    `It showed no activity for ${AUTO_CHILD_IDLE_MINUTES} minutes and was stopped. Its work is kept.`,
  ],
  ['stopped', 'It was stopped.'],
  ['declined', 'You declined this step.'],
  ['process_error', 'The agent ended with an error.'],
  ['no_closing_envelope', 'It ended without saying whether the work was done.'],
  ['artifact_persistence_failed', 'Its result could not be saved.'],
  ['report_missing', 'It ended without writing its report.'],
  ['declared_blocked', "It said it can't go on."],
  ['missing_tool', 'It had no shell to run the commands of the task.'],
  ['needs_shell', "It needs a command run, and it can't run one."],
  ['needs_writer', 'It needs files changed, and it only reads.'],
  ['needs_role', 'It needs another kind of agent for part of the work.'],
  ['needs_decision', 'It needs Auto to choose before it goes on.'],
  ['needs_user', 'It needs something only you can give.'],
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
