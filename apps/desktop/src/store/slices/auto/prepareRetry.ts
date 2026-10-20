import { parseAutoDelegationRole, publishOfRequest, type DelegateChildSpec } from '@goodboy/core';
import {
  getAutoArtifactVersionOfAttempt,
  getAutoDelegation,
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
  readAutoArtifactLiveState,
  type AutoDelegation,
  type AutoTree,
} from '@goodboy/db';
import { brandId, type ArtifactId, type AutoDelegationId } from '@goodboy/types';
import type { ChildRefusal } from './resolveDelegateChild';
import type { AgentVerbContext } from './verbContext';

export type RecoveredRevise = Readonly<{
  delegationId: string;
  artifactId: string;
  revision: number;
  result: unknown;
}>;

export type PreparedRetry =
  | Readonly<{ kind: 'resolve'; child: DelegateChildSpec; original: AutoDelegation }>
  | Readonly<{ kind: 'recovered'; recovery: RecoveredRevise }>
  | Readonly<{ kind: 'refused'; refusal: ChildRefusal }>;

export type PrepareRetryParams = Readonly<{
  ctx: AgentVerbContext;
  tree: AutoTree;
  child: DelegateChildSpec;
  slot: number;
}>;

type TextParams = {
  readonly source: Readonly<Record<string, unknown>>;
  readonly key: string;
};

const textOf = ({ source, key }: TextParams): string | null => {
  const value = source[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

const listOf = ({ source, key }: TextParams): ReadonlyArray<string> => {
  const value = source[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
};

type RefuseParams = {
  readonly slot: number;
  readonly code: ChildRefusal['code'];
  readonly message: string;
};

const refuse = ({ slot, code, message }: RefuseParams): PreparedRetry => ({
  kind: 'refused',
  refusal: { slot, code, message },
});

type RecoveryParams = {
  readonly ctx: AgentVerbContext;
  readonly original: AutoDelegation;
  readonly artifactId: ArtifactId;
};

const committedVersionOf = async ({
  ctx,
  original,
  artifactId,
}: RecoveryParams): Promise<RecoveredRevise | null> => {
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: original.id });
  for (const attempt of attempts) {
    const version = await getAutoArtifactVersionOfAttempt({
      db: ctx.db,
      artifactId,
      attemptId: attempt.id,
    });
    if (version !== null) {
      return {
        delegationId: original.id,
        artifactId,
        revision: version.revision,
        result: original.result,
      };
    }
  }
  return null;
};

export const prepareRetry = async ({
  ctx,
  tree,
  child,
  slot,
}: PrepareRetryParams): Promise<PreparedRetry> => {
  if (child.retryOf === null) {
    return refuse({ slot, code: 'spec_invalid', message: 'a retry names no earlier agent' });
  }
  const original = await getAutoDelegation({
    db: ctx.db,
    delegationId: brandId<AutoDelegationId>({ value: child.retryOf }),
  });
  if (original === null || original.treeId !== tree.id) {
    return refuse({
      slot,
      code: 'delegation_unknown',
      message: 'that agent does not belong to this conversation',
    });
  }
  if (original.state !== 'settled') {
    return refuse({
      slot,
      code: 'retry_unavailable',
      message: 'that agent has not finished, so there is nothing to retry yet',
    });
  }
  const siblings = await listAutoDelegations({ db: ctx.db, treeId: tree.id });
  if (siblings.some((other) => other.retryOf === original.id && other.state !== 'settled')) {
    return refuse({
      slot,
      code: 'retry_unavailable',
      message: 'that agent is already being retried',
    });
  }
  const artifactId =
    original.reviseOf === null ? null : brandId<ArtifactId>({ value: original.reviseOf });
  if (artifactId !== null) {
    const recovery = await committedVersionOf({ ctx, original, artifactId });
    if (recovery !== null) {
      return { kind: 'recovered', recovery };
    }
  }
  const role = parseAutoDelegationRole({ role: original.role });
  if (role === null) {
    return refuse({
      slot,
      code: 'role_unknown',
      message: 'the earlier agent had no role that can be handed work',
    });
  }
  let revises: DelegateChildSpec['revises'] = null;
  if (artifactId !== null) {
    const live = await readAutoArtifactLiveState({ db: ctx.db, artifactId });
    if (live === null) {
      return refuse({
        slot,
        code: 'artifact_unknown',
        message: 'the artifact of the earlier revise is gone',
      });
    }
    revises = { artifactId, expectedRevision: live.revision };
  }
  const synthetic: DelegateChildSpec = {
    role: revises === null ? role : null,
    task: textOf({ source: original.request, key: 'task' }) ?? '',
    reason: child.reason,
    provider: child.provider ?? textOf({ source: original.routing, key: 'provider' }),
    model: child.model ?? textOf({ source: original.routing, key: 'model' }),
    effort: child.effort ?? textOf({ source: original.routing, key: 'effort' }),
    taskType: null,
    difficulty: null,
    doneWhen: textOf({ source: original.request, key: 'doneWhen' }),
    expected: textOf({ source: original.request, key: 'expected' }),
    artifactIds: listOf({ source: original.request, key: 'artifactIds' }),
    mount: textOf({ source: original.target, key: 'mountId' }),
    revises,
    changeFrom: listOf({ source: original.request, key: 'changeFrom' }),
    publish: publishOfRequest({ request: original.request }),
    facts: listOf({ source: original.request, key: 'facts' }),
    decisions: listOf({ source: original.request, key: 'decisions' }),
    forQuestion: null,
    retryOf: original.id,
  };
  return { kind: 'resolve', child: synthetic, original };
};
