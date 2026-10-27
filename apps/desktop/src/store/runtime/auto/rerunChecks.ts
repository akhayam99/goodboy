import {
  canRerunChecks,
  checksRunOfResult,
  isAutoWriterRole,
  type ChecksNotRunReason,
} from '@goodboy/core';
import {
  getAutoDelegation,
  getAutoTree,
  listAutoAttemptsOfDelegation,
  patchAutoAttemptChecksStatement,
  patchAutoDelegationChecksStatement,
} from '@goodboy/db';
import type { AutoDelegationId } from '@goodboy/types';
import { delegationRoleOf } from './attemptEnvelope';
import { runAutoChecks } from './runAutoChecks';
import type { AgentVerbContext } from './verbContext';

export type RerunChecksParams = Readonly<{
  ctx: AgentVerbContext;
  delegationId: AutoDelegationId;
}>;

export type RerunChecksOutcome =
  | Readonly<{ kind: 'rerun'; verdict: 'green' | 'red' | 'not_checked' }>
  | Readonly<{ kind: 'refused'; message: string }>;

const ABORT_FENCE_DELEGATION = 'fence_delegation';
const ABORT_FENCE_ATTEMPT = 'fence_attempt';

const GONE = 'This result is no longer here, so there is nothing to check again.';
const NOTHING_TO_RUN = 'This agent has no checks to run again.';

const REFUSED_TEXT: Readonly<Partial<Record<ChecksNotRunReason, string>>> = {
  tree_moved:
    'The branch changed after this agent finished, so the checks would not describe its work.',
  tree_dirty: 'The tree has uncommitted changes, so the checks would not describe the agent work.',
  none_ticked: 'No scripts are ticked as Auto checks. Tick them in the project settings.',
};

type RefusedParams = {
  readonly message: string;
};

const refused = ({ message }: RefusedParams): RerunChecksOutcome => ({
  kind: 'refused',
  message,
});

export const rerunChecks = async ({
  ctx,
  delegationId,
}: RerunChecksParams): Promise<RerunChecksOutcome> => {
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId });
  if (delegation === null || delegation.state !== 'settled') {
    return refused({ message: GONE });
  }
  const tree = await getAutoTree({ db: ctx.db, treeId: delegation.treeId });
  const previous = checksRunOfResult({ result: delegation.result });
  const mountId = delegation.target['mountId'];
  const worktreePath = delegation.target['worktreePath'];
  const isWriter = isAutoWriterRole({ role: delegationRoleOf({ delegation }) });
  if (
    tree === null ||
    !isWriter ||
    previous === null ||
    !canRerunChecks({ run: previous }) ||
    previous.commit === null ||
    typeof mountId !== 'string' ||
    typeof worktreePath !== 'string'
  ) {
    return refused({ message: NOTHING_TO_RUN });
  }
  const verdict = await runAutoChecks({
    ports: ctx.ports,
    sessionId: tree.sessionId,
    mountId,
    worktreePath,
    expectedHead: previous.commit,
  });
  const reason = verdict.run.reason;
  const refusal = reason === null ? undefined : REFUSED_TEXT[reason];
  if (refusal !== undefined) {
    return refused({ message: refusal });
  }
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId });
  const latest = attempts.filter((attempt) => attempt.state === 'ended').at(-1);
  if (latest === undefined) {
    return refused({ message: GONE });
  }
  const written = await ctx.db.transaction({
    statements: [
      patchAutoDelegationChecksStatement({
        delegationId,
        generation: delegation.generation,
        checks: verdict.checks,
        checksRun: verdict.run,
        abortCode: ABORT_FENCE_DELEGATION,
      }),
      patchAutoAttemptChecksStatement({
        attemptId: latest.id,
        generation: latest.generation,
        checks: verdict.checks,
        checksRun: verdict.run,
        abortCode: ABORT_FENCE_ATTEMPT,
      }),
    ],
  });
  if (written.status !== 'committed') {
    return refused({ message: GONE });
  }
  return { kind: 'rerun', verdict: verdict.run.verdict };
};
