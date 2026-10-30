import {
  AUTO_BRIEF_VERSION,
  AUTO_DELEGATION_DEADLINE_MINUTES,
  canAutoRoleRunCommands,
  composeBranchFacts,
  composeBriefDecisions,
  composeDelegationKickoff,
  delegationDepthOf,
  commandMentionOf,
  roleCannotRunCommandsMessage,
  isAutoSubstepRole,
  isAutoWriterRole,
  substepLinkOf,
  isUserPayload,
  parseAutoDelegationRole,
  type AutoDelegationRole,
  type AdmissionSubstep,
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
  getPausedAutoDelegationOfQuestion,
  listArtifactRevisions,
  listSessionDecisions,
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
  type WorkspaceId,
} from '@goodboy/types';
import { readRunGuidance } from '../runGuidance/readRunGuidance';
import type { AdmitChildInput } from './admit';
import { gatherBranchFacts, mountLabelOf } from './branchFacts/gatherBranchFacts';
import { pickChildMount } from './pickChildMount';
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
    return refuse({
      slot,
      code: 'spec_invalid',
      message:
        '"revises" names no artifact. Name the artifact and its latest version, or drop "revises".',
    });
  }
  const artifactId = brandId<ArtifactId>({ value: revises.artifactId });
  const registered = await getAutoArtifact({ db: ctx.db, artifactId });
  const live = await readAutoArtifactLiveState({ db: ctx.db, artifactId });
  if (registered === null || registered.treeId !== tree.id || live === null) {
    return refuse({
      slot,
      code: 'artifact_unknown',
      message:
        '"revises" names an artifact that is not in this conversation. Use an artifact id Goodboy gave you, or drop "revises".',
    });
  }
  const role = parseAutoDelegationRole({ role: registered.ownerRole });
  if (role === null) {
    return refuse({
      slot,
      code: 'role_unknown',
      message:
        'the artifact in "revises" belongs to no role you can hand work to. Drop "revises" and send new work.',
    });
  }
  if (child.role !== null && child.role !== role) {
    return refuse({
      slot,
      code: 'role_mismatch',
      message: `a revise goes to ${role}, the role that made the artifact. Set "role" to ${role} or leave "role" out.`,
      latestRevision: live.revision,
    });
  }
  if (live.revision !== revises.expectedRevision) {
    return refuse({
      slot,
      code: 'stale_revision',
      message:
        'the artifact in "revises" has a newer version. Set "expectedRevision" to the latest version below and send it again.',
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
      message:
        '"changeFrom" names a message that is not in this conversation. Use a message id Goodboy gave you, or drop "changeFrom".',
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

const retryNoteOf = ({ retry }: RetryNoteParams): string => {
  const ended = `The earlier attempt ended ${retry.outcome ?? 'without a result'} (${retry.reason ?? 'no reason recorded'}).`;
  if (retry.outcome === 'completed') {
    return `${ended} Do the work again from the start of the task below.`;
  }
  return `${ended} Its work is still in this worktree: the commits and the changed files stay. Look at what is already done, keep it, and continue from where it stopped until the task below is done. Do not start over.`;
};

type BriefVersionParams = {
  readonly retry: AutoDelegation | null;
};

const briefVersionOf = ({ retry }: BriefVersionParams): number | null => {
  if (retry === null) {
    return AUTO_BRIEF_VERSION;
  }
  const stored = retry.request['briefVersion'];
  return typeof stored === 'number' ? stored : null;
};

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
    return refuse({
      slot,
      code: 'spec_invalid',
      message: '"role" is missing. Set "role" to a role you can hand work to.',
    });
  }
  if (role === 'rewriter') {
    return refuse({
      slot,
      code: 'spec_invalid',
      message:
        'a History rewriter only runs from the History flow of the branch, in a copy that flow prepares, so Auto cannot start one. Nothing was started. Use an implementer with "publish":{"mode":"force"} for the rewrite: it rewrites the commits on the branch, Goodboy checks the tree, keeps a backup and asks the user to confirm the force push. Goodboy does not check each rewritten commit.',
    });
  }
  const parent =
    child.forQuestion === null
      ? null
      : await getPausedAutoDelegationOfQuestion({
          db: ctx.db,
          treeId: tree.id,
          questionId: child.forQuestion,
        });
  if (child.forQuestion !== null && !isAutoSubstepRole({ role })) {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `"forQuestion" is for a scout or an investigator, and this child is ${role}. Change "role" or drop "forQuestion". Nothing was started`,
    });
  }
  if (child.forQuestion !== null && revise !== null) {
    return refuse({
      slot,
      code: 'spec_invalid',
      message:
        'a substep is a new piece of work, so "forQuestion" and "revises" cannot go together. Drop one of them. Nothing was started',
    });
  }
  if (child.forQuestion !== null && parent === null) {
    return refuse({
      slot,
      code: 'not_paused',
      message: `no agent is waiting on question ${child.forQuestion}. Use the id of a question an agent asked, or drop "forQuestion". Nothing was started`,
    });
  }
  const substep: AdmissionSubstep | null =
    child.forQuestion === null || parent === null
      ? null
      : { parentDelegationId: parent.id, questionId: child.forQuestion };
  if (child.facts.length > 0 && role !== 'scout') {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `"facts" is for a scout: Goodboy reads the branch facts into a scout's brief. Drop "facts" from this ${role} child, or send it to a scout. Nothing was started`,
    });
  }
  if (child.publish !== null && (!isAutoWriterRole({ role }) || role === 'scribe')) {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `"publish" is for an implementer or a CI fixer: they commit work that Goodboy can push. Drop "publish" from this ${role} child, or send it to an implementer. Nothing was started`,
    });
  }
  const commandMention =
    revise === null && !canAutoRoleRunCommands({ role })
      ? commandMentionOf({ text: [child.task, child.doneWhen ?? ''].join('\n') })
      : null;
  if (commandMention !== null) {
    return refuse({
      slot,
      code: 'role_lacks_shell',
      message: roleCannotRunCommandsMessage({ role, match: commandMention }),
    });
  }
  const picked = await pickChildMount({
    ports: ctx.ports,
    sessionId: grant.sessionId,
    role,
    requested: child.mount ?? revise?.producerMountId ?? null,
    mounts,
    primaryMountId: tree.primaryMountId,
    task: child.task,
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
      message:
        'the mount of the earlier attempt moved, so "retryOf" cannot repeat the work on it. Drop "retryOf" and send new work on the mount you want',
    });
  }
  const gathered =
    child.facts.length === 0
      ? null
      : await gatherBranchFacts({
          ports: ctx.ports,
          sessionId: grant.sessionId,
          mounts,
          mountIds: child.facts,
        });
  if (gathered !== null && gathered.kind === 'unknown_mount') {
    return refuse({
      slot,
      code: 'mount_missing',
      message: `"facts" names ${gathered.mountId}, which is not a mount of this conversation. Use a mount id from the mounts list, or drop "facts". Nothing was started`,
    });
  }
  const decisions =
    child.decisions.length === 0
      ? null
      : composeBriefDecisions({
          ids: child.decisions,
          rows: await listSessionDecisions({ db: ctx.db, sessionId: grant.sessionId }),
        });
  const briefVersion = briefVersionOf({ retry });
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
  const guidance = await readRunGuidance({
    db: ctx.db,
    workspaceId: brandId<WorkspaceId>({ value: grant.workspaceId }),
    agentId: tree.rootAgentId,
  });
  const kickoff = composeDelegationKickoff({
    role,
    childAgentId,
    task: child.task,
    doneWhen: child.doneWhen,
    expected: child.expected,
    inputs: inputs.bodies,
    revise: revise === null ? null : revise.revise,
    mountLabel: mountLabelOf({ mount }),
    facts: gathered === null ? null : composeBranchFacts({ facts: gathered.facts }),
    decisions,
    retryNote: retry === null ? null : retryNoteOf({ retry }),
    guidance,
    isSubstep:
      substep !== null || (retry !== null && substepLinkOf({ request: retry.request }) !== null),
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
        ...(child.title !== null && { title: child.title }),
        task: child.task,
        reason: child.reason,
        ...(child.shouldConfirm && { confirm: true }),
        doneWhen: child.doneWhen,
        expected: child.expected,
        kickoff,
        mountLabel: mountLabelOf({ mount }),
        artifactIds: child.artifactIds,
        changeFrom: child.changeFrom,
        ...(child.facts.length > 0 && { facts: child.facts }),
        ...(child.decisions.length > 0 && { decisions: child.decisions }),
        ...(briefVersion !== null && { briefVersion }),
        ...(retry !== null &&
          retry.request['parent'] !== undefined && { parent: retry.request['parent'] }),
        ...(parent !== null &&
          substep !== null && {
            parent: {
              delegationId: parent.id,
              questionId: substep.questionId,
              depth: delegationDepthOf({ request: parent.request }) + 1,
            },
          }),
        ...(child.publish !== null && { publish: child.publish }),
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
      isConfirmForced: child.shouldConfirm || words?.isAmbiguous === true,
      retryOf: retry?.id ?? null,
      substep,
      deadlineAt: nowMs + AUTO_DELEGATION_DEADLINE_MINUTES * 60_000,
    },
  };
};
