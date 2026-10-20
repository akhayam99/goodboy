import { AUTO_REFUSAL_CODES, type AutoRefusalCode } from './refusals';

export const AUTO_REFUSAL_USER_REASON = {
  request_conflict: 'it reused a request id for different work',
  depth_cap: 'only Auto can hand work over',
  substep_cap: 'too many helpers for one agent',
  breadth_cap: 'too many agents at once',
  empty_batch: 'it named no agent',
  budget: 'the limit left does not cover it',
  already_yielded: 'it already handed work over in this turn',
  not_deciding: 'the turn had already ended',
  tree_stopped: 'the conversation was stopped',
  generation_changed: 'the work was restarted',
  not_owner: 'another window runs this conversation',
  limit_calls: 'too many hand overs in one turn',
  limit_refusals: 'too many refused hand overs in this conversation',
  limit_wall_clock: 'the conversation reached its time limit',
  artifact_unknown: 'the artifact it named is not in this conversation',
  stale_revision: 'the artifact it named has a newer version',
  artifact_consumed: 'the artifact it named was already used',
  artifact_discarded: 'the artifact it named was discarded',
  artifact_busy: 'the artifact it named is already being worked on',
  artifact_revising: 'the artifact it named is being rewritten',
  artifact_unapproved: 'the plan is not approved yet',
  role_mismatch: 'a change to an artifact goes to the role that made it',
  tree_busy: 'the conversation was busy',
  spec_invalid: 'the request was not valid',
  role_unknown: 'it named a role it cannot use',
  no_provider: 'no model is available for that role',
  provider_unproven: 'the model for that role cannot be confined yet',
  mount_missing: 'it did not say which folder, or that folder is not usable',
  mount_ambiguous: 'more than one folder fits and it did not say which',
  delegation_unknown: 'it named an agent that is not in this conversation',
  question_unknown: 'it answered a question nobody asked',
  not_paused: 'that agent is not waiting for an answer',
  no_run: 'that agent has no run to continue',
  retry_unavailable: 'that work cannot be retried',
  role_lacks_shell: 'the role it chose cannot run commands',
} as const satisfies Readonly<Record<AutoRefusalCode, string>>;

type UserReasonParams = {
  readonly code: string;
};

export const autoRefusalUserReason = ({ code }: UserReasonParams): string => {
  const known = AUTO_REFUSAL_CODES.find((candidate) => candidate === code);
  return known === undefined ? 'Goodboy refused the request' : AUTO_REFUSAL_USER_REASON[known];
};
