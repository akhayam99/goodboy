import {
  AUTO_DELEGATION_DEADLINE_MINUTES,
  composeDelegationKickoff,
  isUserPayload,
  parseAutoDelegationRole,
  pickAutoMount,
  type AutoDelegationRole,
  type AutoRefusalCode,
  type DelegateChildSpec,
  type KickoffArtifactInput,
  type KickoffRevise,
  type PickableMount,
} from '@goodboy/core';
import {
  getAutoArtifact,
  getAutoDelegation,
  getAutoOutbox,
  listArtifactRevisions,
  readAutoArtifactLiveState,
  type AutoDelegation,
  type AutoTree,
} from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoOutboxId,
} from '@goodboy/types';
import type { AdmitChildInput } from './admit';
import type { AgentGrant } from './ports';
import type { AgentVerbContext } from './verbContext';

export type ChildRefusal = Readonly<{
  slot: number;
  code: AutoRefusalCode;
  message: string;
  latestRevision?: number | null;
}>;

export type ResolvedDelegateChild =
  | Readonly<{ kind: 'ok'; input: AdmitChildInput }>
  | Readonly<{ kind: 'refused'; refusal: ChildRefusal }>;

export type ResolveDelegateChildParams = Readonly<{
  ctx: AgentVerbContext;
  grant: AgentGrant;
  tree: AutoTree;
  child: DelegateChildSpec;
  slot: number;
  mounts: ReadonlyArray<PickableMount>;
  retry?: AutoDelegation | null;
}>;

type RefuseParams = {
  readonly slot: number;
  readonly code: AutoRefusalCode;
  readonly message: string;
  readonly latestRevision?: number | null;
};

const refuse = ({ slot, code, message, latestRevision }: RefuseParams): ResolvedDelegateChild => ({
  kind: 'refused',
  refusal: { slot, code, message, ...(latestRevision === undefined ? {} : { latestRevision }) },
});

type TextParams = {
  readonly source: Readonly<Record<string, unknown>>;
  readonly key: string;
};

const textOf = ({ source, key }: TextParams): string | null => {
  const value = source[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

type UserWordsParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly rowIds: ReadonlyArray<string>;
};

type UserWords = Readonly<{
  words: ReadonlyArray<string>;
  isAmbiguous: boolean;
  isUnknown: boolean;
}>;

const userWordsOf = async ({ ctx, tree, rowIds }: UserWordsParams): Promise<UserWords> => {
  const words: string[] = [];
  let isAmbiguous = false;
  let isUnknown = false;
  for (const rowId of rowIds) {
    const row = await getAutoOutbox({
      db: ctx.db,
      outboxId: brandId<AutoOutboxId>({ value: rowId }),
    });
    if (row === null || row.treeId !== tree.id || !isUserPayload(row.payload)) {
      isUnknown = true;
      continue;
    }
    words.push(row.payload.text);
    const facts = row.payload.facts;
    if (facts.isAmbiguous && facts.explicitChange === null && facts.focusArtifactId === null) {
      isAmbiguous = true;
    }
  }
  return { words, isAmbiguous, isUnknown };
};

type InputsParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly artifactIds: ReadonlyArray<string>;
};

type ResolvedInputs = Readonly<{
  refs: AdmitChildInput['inputArtifacts'];
  bodies: ReadonlyArray<KickoffArtifactInput>;
}>;

const inputsOf = async ({ ctx, tree, artifactIds }: InputsParams): Promise<ResolvedInputs> => {
  const refs: Array<AdmitChildInput['inputArtifacts'][number]> = [];
  const bodies: KickoffArtifactInput[] = [];
  for (const artifactId of artifactIds) {
    const id = brandId<ArtifactId>({ value: artifactId });
    const registered = await getAutoArtifact({ db: ctx.db, artifactId: id });
    const live = await readAutoArtifactLiveState({ db: ctx.db, artifactId: id });
    if (registered === null || registered.treeId !== tree.id || live === null) {
      refs.push({ artifactId: id, revision: 0 });
      continue;
    }
    refs.push({ artifactId: id, revision: live.revision });
    bodies.push({
      artifactId,
      kind: registered.kind,
      title: live.title,
      revision: live.revision,
      body: live.sourceText,
    });
  }
  return { refs, bodies };
};

type ReviseTargetParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly child: DelegateChildSpec;
  readonly slot: number;
};

type ReviseTarget = Readonly<{
  role: AutoDelegationRole;
  agentId: AgentId;
  artifactId: ArtifactId;
  expectedRevision: number;
  producerMountId: string | null;
  producerRouting: Readonly<Record<string, unknown>>;
  revise: KickoffRevise;
}>;

const reviseTargetOf = async ({
  ctx,
  tree,
  child,
  slot,
}: ReviseTargetParams): Promise<ReviseTarget | ResolvedDelegateChild> => {
  const revises = child.revises;
  if (revises === null) {
    return refuse({ slot, code: 'spec_invalid', message: 'a revise names no artifact' });
  }
  const artifactId = brandId<ArtifactId>({ value: revises.artifactId });
  const registered = await getAutoArtifact({ db: ctx.db, artifactId });
  const live = await readAutoArtifactLiveState({ db: ctx.db, artifactId });
  if (registered === null || registered.treeId !== tree.id || live === null) {
    return refuse({
      slot,
      code: 'artifact_unknown',
      message: 'that artifact is not in this conversation',
    });
  }
  const role = parseAutoDelegationRole({ role: registered.ownerRole });
  if (role === null) {
    return refuse({ slot, code: 'role_unknown', message: 'the artifact belongs to no known role' });
  }
  if (child.role !== null && child.role !== role) {
    return refuse({
      slot,
      code: 'role_mismatch',
      message: `a revise goes to ${role}, the role that made it`,
      latestRevision: live.revision,
    });
  }
  if (live.revision !== revises.expectedRevision) {
    return refuse({
      slot,
      code: 'stale_revision',
      message: 'the artifact moved on',
      latestRevision: live.revision,
    });
  }
  const producer = await getAutoDelegation({
    db: ctx.db,
    delegationId: registered.ownerDelegationId,
  });
  const words = await userWordsOf({ ctx, tree, rowIds: child.changeFrom });
  if (words.isUnknown) {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: 'changeFrom names a message that is not in this conversation',
    });
  }
  const history = (await listArtifactRevisions({ db: ctx.db, artifactId }))
    .slice(0, 3)
    .map((entry) => ({ revision: entry.revision, author: entry.author, ask: entry.ask }));
  return {
    role,
    agentId: registered.ownerAgentId,
    artifactId,
    expectedRevision: revises.expectedRevision,
    producerMountId: producer === null ? null : textOf({ source: producer.target, key: 'mountId' }),
    producerRouting: producer?.routing ?? {},
    revise: {
      artifactId: revises.artifactId,
      kind: registered.kind,
      title: live.title,
      revision: live.revision,
      body: live.sourceText,
      userWords: words.words,
      autoReading: child.task === '' ? null : child.task,
      history,
    },
  };
};

type RetryNoteParams = {
  readonly retry: AutoDelegation;
};

const retryNoteOf = ({ retry }: RetryNoteParams): string =>
  `The earlier attempt ended ${retry.outcome ?? 'without a result'} (${retry.reason ?? 'no reason recorded'}). Do the work again from the start of the task below.`;

const isResolved = (value: ReviseTarget | ResolvedDelegateChild): value is ResolvedDelegateChild =>
  'kind' in value;

export const resolveDelegateChild = async ({
  ctx,
  grant,
  tree,
  child,
  slot,
  mounts,
  retry = null,
}: ResolveDelegateChildParams): Promise<ResolvedDelegateChild> => {
  const revise = child.revises === null ? null : await reviseTargetOf({ ctx, tree, child, slot });
  if (revise !== null && isResolved(revise)) {
    return revise;
  }
  const role = revise === null ? child.role : revise.role;
  if (role === null) {
    return refuse({ slot, code: 'spec_invalid', message: 'the child needs a role' });
  }
  const picked = pickAutoMount({
    role,
    requested: child.mount ?? revise?.producerMountId ?? null,
    mounts,
    primaryMountId: tree.primaryMountId,
  });
  if (picked.kind === 'refused') {
    return refuse({ slot, code: picked.code, message: picked.message });
  }
  const capturedPath =
    retry === null ? null : textOf({ source: retry.target, key: 'worktreePath' });
  if (capturedPath !== null && picked.mount.worktreePath !== capturedPath) {
    return refuse({
      slot,
      code: 'mount_missing',
      message: 'the mount of the earlier attempt moved, so the work cannot repeat on it',
    });
  }
  const inputs = await inputsOf({ ctx, tree, artifactIds: child.artifactIds });
  const words = revise === null ? null : await userWordsOf({ ctx, tree, rowIds: child.changeFrom });
  const producerRouting = revise?.producerRouting ?? {};
  const routing = await ctx.ports.resolveRouting({
    sessionId: grant.sessionId,
    role,
    fields: {
      provider: child.provider ?? textOf({ source: producerRouting, key: 'provider' }) ?? undefined,
      model: child.model ?? textOf({ source: producerRouting, key: 'model' }) ?? undefined,
      effort: child.effort ?? textOf({ source: producerRouting, key: 'effort' }) ?? undefined,
      taskType: child.taskType ?? undefined,
      difficulty: child.difficulty ?? undefined,
    },
    promptText: revise === null ? child.task : [child.task, ...(words?.words ?? [])].join('\n'),
  });
  if (routing.kind === 'blocked') {
    return refuse({ slot, code: routing.code, message: routing.message });
  }
  const mount = picked.mount;
  const childAgentId =
    revise === null
      ? (retry?.childAgentId ?? brandId<AgentId>({ value: ctx.ports.newId() }))
      : revise.agentId;
  const kickoff = composeDelegationKickoff({
    role,
    childAgentId,
    task: child.task,
    doneWhen: child.doneWhen,
    expected: child.expected,
    inputs: inputs.bodies,
    revise: revise === null ? null : revise.revise,
    mountLabel: `${mount.id} (${mount.mountName ?? 'unnamed'}, branch ${mount.branch})`,
    retryNote: retry === null ? null : retryNoteOf({ retry }),
  });
  const nowMs = ctx.now();
  return {
    kind: 'ok',
    input: {
      delegationId: brandId<AutoDelegationId>({ value: ctx.ports.newId() }),
      childAgentId,
      attemptId: brandId<AutoAttemptId>({ value: ctx.ports.newId() }),
      role,
      request: {
        task: child.task,
        reason: child.reason,
        doneWhen: child.doneWhen,
        expected: child.expected,
        kickoff,
        mountLabel: `${mount.id} (${mount.mountName ?? 'unnamed'}, branch ${mount.branch})`,
        artifactIds: child.artifactIds,
        changeFrom: child.changeFrom,
      },
      target: {
        mountId: mount.id,
        mountRevision: mount.revision,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        projectId: mount.projectId,
        mountName: mount.mountName,
        mountSource: picked.source,
        sessionId: grant.sessionId,
        workspaceId: grant.workspaceId,
      },
      routing: {
        provider: routing.provider,
        model: routing.model,
        effort: routing.effort,
        reason: routing.reason,
        proposal: routing.proposal,
        requested: {
          provider: child.provider,
          model: child.model,
          effort: child.effort,
        },
      },
      reviseOf:
        revise === null
          ? null
          : { artifactId: revise.artifactId, expectedRevision: revise.expectedRevision },
      inputArtifacts: inputs.refs,
      isConfirmForced: words?.isAmbiguous === true,
      retryOf: retry?.id ?? null,
      deadlineAt: nowMs + AUTO_DELEGATION_DEADLINE_MINUTES * 60_000,
    },
  };
};
