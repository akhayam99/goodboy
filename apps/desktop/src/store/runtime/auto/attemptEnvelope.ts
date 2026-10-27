import {
  AUTO_ROLE_ARTIFACT,
  buildDelegationResult,
  parseAutoDelegationRole,
  type AutoDelegationRole,
  type ChecksVerdict,
  type ChildClosing,
  type DelegationResultV1,
  type ProcessExit,
  type ResultPublish,
  type ResultArtifact,
  type ResultChangedFile,
  type ResultQuestion,
  type ResultRemote,
} from '@goodboy/core';
import type { AutoAttempt, AutoDelegation } from '@goodboy/db';

export type AttemptEnvelopeParams = Readonly<{
  delegation: AutoDelegation;
  attempt: AutoAttempt;
  generation: number;
  exit: ProcessExit;
  isTimedOut?: boolean;
  closing: ChildClosing | null;
  changedFiles?: ReadonlyArray<ResultChangedFile>;
  remote?: ResultRemote | null;
  verification?: ChecksVerdict | null;
  publish?: ResultPublish | null;
  artifacts?: ReadonlyArray<ResultArtifact>;
  artifactPersistence?: DelegationResultV1['artifactPersistence'];
  openQuestions?: ReadonlyArray<ResultQuestion>;
  costUsd: number | null;
  turns?: number;
  durationMs?: number;
  summary?: string | null;
}>;

type RoutingTextParams = {
  readonly delegation: AutoDelegation;
  readonly key: string;
};

const routingText = ({ delegation, key }: RoutingTextParams): string => {
  const value = delegation.routing[key];
  return typeof value === 'string' ? value : '';
};

type RoleParams = {
  readonly delegation: AutoDelegation;
};

export const delegationRoleOf = ({ delegation }: RoleParams): AutoDelegationRole =>
  parseAutoDelegationRole({ role: delegation.role }) ?? 'scout';

export const isArtifactRole = ({ delegation }: RoleParams): boolean =>
  AUTO_ROLE_ARTIFACT[delegationRoleOf({ delegation })] !== null;

export const attemptEnvelope = ({
  delegation,
  attempt,
  generation,
  exit,
  isTimedOut = false,
  closing,
  changedFiles = [],
  remote = null,
  verification = null,
  publish = null,
  artifacts = [],
  artifactPersistence,
  openQuestions = [],
  costUsd,
  turns = 1,
  durationMs = 0,
  summary = null,
}: AttemptEnvelopeParams): DelegationResultV1 => {
  const role = delegationRoleOf({ delegation });
  const isExpected = isArtifactRole({ delegation });
  return buildDelegationResult({
    delegationId: delegation.id,
    attemptId: attempt.id,
    treeId: delegation.treeId,
    generation,
    childAgentId: delegation.childAgentId,
    role,
    routing: {
      provider: routingText({ delegation, key: 'provider' }),
      model: routingText({ delegation, key: 'model' }),
      effort: routingText({ delegation, key: 'effort' }),
      reason: routingText({ delegation, key: 'reason' }),
    },
    exit,
    isTimedOut,
    turns,
    durationMs,
    closing,
    summary,
    summarySource: summary === null ? 'child' : 'summarizer',
    changedFiles,
    checks: verification?.checks ?? [],
    checksRun: verification?.run ?? null,
    publish,
    remote,
    artifacts,
    artifactPersistence: artifactPersistence ?? (isExpected ? 'failed' : 'not_applicable'),
    isArtifactExpected: isExpected,
    openQuestions,
    costUsd,
  });
};
