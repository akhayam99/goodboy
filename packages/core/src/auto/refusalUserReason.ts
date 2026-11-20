import { AUTO_REFUSAL_CODES, type AutoRefusalCode } from './refusals';

export const AUTO_REFUSAL_USER_REASON = {
  request_conflict: 'it reused a request id for different work',
  depth_cap: 'only the Lead can start agents',
  substep_cap: 'a helper never has its own helper',
  empty_batch: 'it named no agent',
  budget: 'the conversation reached its limit',
  already_yielded: 'it already handed work over in this turn',
  not_deciding: 'the turn had already ended',
  tree_stopped: 'the conversation was stopped',
  generation_changed: 'the work was restarted',
  not_owner: 'another window runs this conversation',
  artifact_unknown: "the artifact it named isn't in this conversation",
  stale_revision: 'the artifact it named has a newer version',
  artifact_consumed: 'the artifact it named was already used',
  artifact_discarded: 'the artifact it named was discarded',
  artifact_busy: 'the artifact it named is already being worked on',
  artifact_revising: 'the artifact it named is being rewritten',
  artifact_unapproved: "the plan isn't approved yet",
  role_mismatch: 'a change to an artifact goes to the role that made it',
  tree_busy: 'the conversation was busy',
  spec_invalid: "the request wasn't valid",
  role_unknown: "it named a role it can't use",
  no_provider: 'no model is available for that role',
  provider_unproven: "the model for that role can't be confined yet",
  mount_missing: "it didn't say which folder, or that folder isn't usable",
  mount_ambiguous: "more than one folder fits and it didn't say which",
  mount_elsewhere: 'that project is already added on another branch',
  delegation_unknown: "it named an agent that isn't in this conversation",
  question_unknown: 'it answered a question nobody asked',
  not_paused: "that agent isn't waiting for an answer",
  no_run: 'that agent has no run to continue',
  retry_unavailable: "that work can't be retried",
  role_lacks_shell: 'the role it chose cannot run commands',
  role_narrower: 'a narrower role fits the task',
  return_limit: 'that agent came back too many times to continue it',
  task_rebrief_limit: 'that task was handed over too many times',
  not_returned: "it released an agent that wasn't waiting for it",
  message_limit: 'it sent that agent too many messages',
  not_running: "it wrote to an agent that wasn't working",
} as const satisfies Readonly<Record<AutoRefusalCode, string>>;

type UserReasonParams = {
  readonly code: string;
};

export const autoRefusalUserReason = ({ code }: UserReasonParams): string => {
  const known = AUTO_REFUSAL_CODES.find((candidate) => candidate === code);
  return known === undefined ? 'Goodboy refused the request' : AUTO_REFUSAL_USER_REASON[known];
};
