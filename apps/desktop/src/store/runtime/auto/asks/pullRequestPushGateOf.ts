import { publishOfResult, type RemoteRead, type ResultPublish } from '@goodboy/core/auto';
import {
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
  type AutoDelegation,
} from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { hostChangeRefusalOf } from '../launchGuard/hostChangeRefusalOf';
import { readChangeRules } from '../launchGuard/readChangeRules';
import { readPublishPermissions } from '../level/readPublishPermissions';
import { readSnapshot } from '../readSnapshot';
import type { AgentVerbContext } from '../verbContext';

export type PullRequestPushGate =
  | Readonly<{ kind: 'go'; sha: string }>
  | Readonly<{ kind: 'held'; message: string; raise: ResultPublish | null }>
  | Readonly<{ kind: 'blocked'; message: string }>;

const NO_BRANCH = 'the branch of this pull request is unknown, so nothing was published';
const NO_HEAD = 'the branch could not be read, so nothing was published';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
};

type LineParams = {
  readonly branch: string;
  readonly head: string;
};

const waitingLine = ({ branch, head }: LineParams): string =>
  `The pull request opens after you push ${branch} at ${head.slice(0, 7)}`;

const declinedLine = ({ branch }: LineParams): string =>
  `Not opened: you declined the push of ${branch}, and the pull request needs it online first`;

type FailedLineParams = LineParams & {
  readonly message: string | null;
};

const failedLine = ({ branch, head, message }: FailedLineParams): string =>
  `Not opened: the push of ${branch} at ${head.slice(0, 7)} was held${message === null ? '' : `: ${message}`}`;

const raisedOf = ({ branch, head }: LineParams): ResultPublish => ({
  mode: 'push',
  state: 'awaiting_confirm',
  branch,
  sha: head,
  leaseSha: null,
  backupRef: null,
  message: null,
  isRetryable: false,
  isConfirmed: false,
  startedAt: null,
  tries: 0,
  reviewerReportId: null,
  isContentChanging: false,
});

type OnlineParams = {
  readonly ctx: AgentVerbContext;
  readonly worktreePath: string;
  readonly branch: string;
};

const onlineOf = ({ ctx, worktreePath, branch }: OnlineParams): Promise<RemoteRead> =>
  ctx.ports.readRemoteHead({ worktreePath, branch }).catch((): RemoteRead => ({ kind: 'unknown' }));

type HostParams = Params & {
  readonly worktreePath: string;
  readonly branch: string;
  readonly head: string;
};

const hostRefusalOf = async ({
  ctx,
  delegation,
  worktreePath,
  branch,
  head,
}: HostParams): Promise<string | null> => {
  const sessionId = delegation.target['sessionId'];
  if (typeof sessionId !== 'string') {
    return NO_BRANCH;
  }
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: delegation.id });
  const changes = await readChangeRules({
    db: ctx.db,
    treeId: delegation.treeId,
    attempt: attempts.at(-1) ?? null,
  });
  const refusal = await hostChangeRefusalOf({
    ports: ctx.ports,
    sessionId: brandId<SessionId>({ value: sessionId }),
    worktreePath,
    branch,
    sha: head,
    changes,
  });
  return refusal === null ? null : `Not opened: ${refusal.message}`;
};

export const pullRequestPushGateOf = async ({
  ctx,
  delegation,
}: Params): Promise<PullRequestPushGate> => {
  const { push } = await readPublishPermissions({ db: ctx.db, treeId: delegation.treeId });
  const worktreePath = delegation.target['worktreePath'];
  const branch = delegation.target['branch'];
  if (typeof worktreePath !== 'string' || typeof branch !== 'string' || branch === '') {
    return { kind: 'blocked', message: NO_BRANCH };
  }
  const head = (await readSnapshot({ ports: ctx.ports, worktreePath }))?.head ?? null;
  if (head === null) {
    return { kind: 'blocked', message: NO_HEAD };
  }
  const go: PullRequestPushGate = { kind: 'go', sha: head };
  const online = await onlineOf({ ctx, worktreePath, branch });
  if (online.kind === 'sha' && online.sha === head) {
    return go;
  }
  const delegations = await listAutoDelegations({ db: ctx.db, treeId: delegation.treeId });
  const records = delegations
    .filter((row) => row.state === 'settled' && row.generation === delegation.generation)
    .map((row) => publishOfResult({ result: row.result }))
    .filter((record) => record !== null && record.branch === branch && record.sha === head);
  if (records.some((record) => record?.state === 'pushed')) {
    return go;
  }
  const isWaiting = records.some(
    (record) => record?.state === 'awaiting_confirm' || record?.state === 'pushing',
  );
  if (isWaiting) {
    return { kind: 'held', message: waitingLine({ branch, head }), raise: null };
  }
  if (records.some((record) => record?.state === 'declined')) {
    return { kind: 'held', message: declinedLine({ branch, head }), raise: null };
  }
  const failed = records.find((record) => record?.state === 'failed');
  if (push !== 'ask' && failed !== undefined) {
    const message = failedLine({ branch, head, message: failed?.message ?? null });
    return { kind: 'held', message, raise: null };
  }
  const refusal = await hostRefusalOf({ ctx, delegation, worktreePath, branch, head });
  if (refusal !== null) {
    return { kind: 'blocked', message: refusal };
  }
  if (push !== 'ask') {
    return go;
  }
  return {
    kind: 'held',
    message: waitingLine({ branch, head }),
    raise: raisedOf({ branch, head }),
  };
};
