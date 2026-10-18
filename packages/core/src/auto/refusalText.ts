import { AUTO_BATCH_MAX_CHILDREN, AUTO_TREE_LIMITS } from './limits';
import type { AutoRefusalCode } from './refusals';

export const AUTO_REFUSAL_TEXT = {
  request_conflict:
    'That request id was already used with a different spec. Send the same spec again to repeat the call, or use a new id.',
  depth_cap: 'Only the Auto agent of a conversation hands work over. An agent never delegates.',
  breadth_cap: `At most ${AUTO_BATCH_MAX_CHILDREN} agents can run at once. Wait for results, or send fewer children.`,
  empty_batch: 'The batch has no children.',
  budget:
    'The budget left does not cover this batch. Send fewer or cheaper children, or ask the user to raise the limit.',
  already_yielded:
    'You already handed work over in this turn. End your turn now. The agents start when it is over.',
  not_deciding: 'This is not a turn Auto is answering in right now.',
  tree_stopped: 'This conversation was stopped.',
  generation_changed: 'The work was restarted since this turn began.',
  not_owner: 'Another window runs this conversation. Try again in a moment.',
  limit_delegations: 'This conversation reached its limit of delegated agents.',
  limit_attempts: 'This conversation reached its limit of agent runs.',
  limit_calls: `You may call delegate ${AUTO_TREE_LIMITS.delegateCallsPerTurn} times in one turn. End your turn.`,
  limit_refusals: 'Too many delegate calls were refused in this conversation. Tell the user.',
  limit_wall_clock: 'This conversation reached its time limit.',
  artifact_unknown: 'That artifact does not belong to this conversation.',
  stale_revision: 'That artifact has a newer version. Read it again and retry once.',
  artifact_consumed:
    'That artifact was already used for work. Hand over a new piece of work instead.',
  artifact_discarded: 'That artifact was discarded.',
  artifact_busy: 'That artifact, or the agent that made it, is already being worked on.',
  artifact_revising: 'That artifact is being rewritten. Wait for the new version.',
  artifact_unapproved: 'The user has not approved that plan yet.',
  role_mismatch: 'A revise goes to the role that made the artifact.',
  tree_busy: 'The conversation is busy right now. Try again.',
  spec_invalid: 'The spec is not valid.',
  role_unknown: 'That is not a role you can hand work to.',
  no_provider: 'No model is available for that role right now.',
  provider_unproven: 'The model chosen for that role cannot be confined to the role yet.',
  mount_missing: 'That mount cannot be used.',
  mount_ambiguous: 'More than one mount matches.',
  delegation_unknown: 'That agent does not belong to this conversation.',
  question_unknown: 'That agent asked no such question.',
  not_paused: 'That agent is not waiting for an answer.',
  no_run: 'There is no turn to attach this to.',
  retry_unavailable: 'That agent cannot be retried right now.',
  role_lacks_shell: 'That role has no shell, so it cannot run the commands of the task.',
} as const satisfies Readonly<Record<AutoRefusalCode, string>>;

export type RefusalChild = Readonly<{
  slot: number;
  code: AutoRefusalCode;
  message?: string;
  latestRevision?: number | null;
}>;

type DescribeParams = {
  readonly code: AutoRefusalCode;
  readonly message?: string;
  readonly perChild?: ReadonlyArray<RefusalChild>;
};

export const describeAutoRefusal = ({ code, message, perChild = [] }: DescribeParams): string => {
  const lines = [message ?? AUTO_REFUSAL_TEXT[code]];
  for (const child of perChild) {
    const latest =
      child.latestRevision === null || child.latestRevision === undefined
        ? ''
        : ` (latest version ${child.latestRevision})`;
    lines.push(
      `child ${child.slot + 1}: ${child.code}${latest}${child.message === undefined ? '' : `: ${child.message}`}`,
    );
  }
  return lines.join('\n');
};
