import {
  ADOPTION_REFUSAL_TEXT,
  EMPTY_USER_FACTS,
  adoptionRoleOf,
  buildAdoptedResult,
  composeAdoptionKickoff,
  diagnoseAdoption,
  sha256Hex,
  type AdoptionRefusalCode,
  type ResultArtifact,
} from '@goodboy/core';
import {
  AUTO_ADOPT_ABORT,
  adoptAgentStatements,
  getAgentById,
  getAdoptionOfAgent,
  listArtifactsForSession,
  type AdoptedArtifact,
  type Database,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import {
  brandId,
  type AgentId,
  type AutoDelegationId,
  type AutoTreeId,
  type ProviderId,
  type SessionId,
} from '@goodboy/types';
import { EFFORT_LEVELS } from '../../../features/chat/utils/chat-constants';

const AUTO_AGENT_NAME = 'Auto';
const HOUR_MS = 60 * 60 * 1000;
const WALL_CLOCK_HOURS = 24;
const MAX_ORDINAL_ATTEMPTS = 3;

type AdoptSource = Readonly<{
  kind: string;
  roleLabel: string;
  isTurnLive: boolean;
  goal: string;
  lastReply: string;
  mountLabel: string | null;
  provider: string;
  model: string;
  effort: string;
}>;

type AdoptAutoRouting = Readonly<{
  provider: ProviderId;
  model: string;
  effort: string;
}>;

export type AdoptAgentParams = Readonly<{
  db: Database;
  sessionId: SessionId;
  sourceAgentId: AgentId;
  source: AdoptSource;
  instruction: string;
  autoRouting: AdoptAutoRouting;
  primaryMountId: string | null;
  capUsd: number | null;
  nowMs: number;
  newId: () => string;
}>;

export type AdoptOutcome =
  | Readonly<{
      kind: 'adopted';
      treeId: AutoTreeId;
      autoAgentId: AgentId;
      delegationId: AutoDelegationId;
    }>
  | Readonly<{ kind: 'exists'; treeId: AutoTreeId; autoAgentId: AgentId }>
  | Readonly<{ kind: 'refused'; code: AdoptionRefusalCode; message: string }>
  | Readonly<{ kind: 'failed'; message: string }>;

type AbortParams = {
  readonly abortCode: string;
};

const refusalOfAbort = ({ abortCode }: AbortParams): AdoptionRefusalCode | null => {
  switch (abortCode) {
    case AUTO_ADOPT_ABORT.gone:
      return 'agent_gone';
    case AUTO_ADOPT_ABORT.inRun:
      return 'in_run';
    case AUTO_ADOPT_ABORT.turnRunning:
      return 'turn_running';
    case AUTO_ADOPT_ABORT.inAuto:
      return 'already_in_auto';
    case AUTO_ADOPT_ABORT.cycle:
      return 'cycle';
    default:
      return null;
  }
};

type RefusedParams = {
  readonly code: AdoptionRefusalCode;
};

const refused = ({ code }: RefusedParams): AdoptOutcome => ({
  kind: 'refused',
  code,
  message: ADOPTION_REFUSAL_TEXT[code],
});

type EffortParams = {
  readonly value: string;
};

const effortOf = ({
  value,
}: EffortParams): { readonly effort?: (typeof EFFORT_LEVELS)[number] } => {
  const effort = EFFORT_LEVELS.find((level) => level === value);
  return effort === undefined ? {} : { effort };
};

type OrdinalParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

const nextOrdinal = async ({ db, sessionId }: OrdinalParams): Promise<number> => {
  const rows = await db.select<{ readonly next: number }>(
    'SELECT COALESCE(MAX(ordinal), -1) + 1 AS next FROM agents WHERE session_id = ?',
    [sessionId],
  );
  return rows[0]?.next ?? 0;
};

type ExistingParams = {
  readonly db: Database;
  readonly sourceAgentId: AgentId;
};

const existingAdoption = async ({
  db,
  sourceAgentId,
}: ExistingParams): Promise<AdoptOutcome | null> => {
  const adopted = await getAdoptionOfAgent({ db, agentId: sourceAgentId });
  if (adopted === null) {
    return null;
  }
  const rows = await db.select<{ readonly root_agent_id: string }>(
    'SELECT root_agent_id FROM auto_trees WHERE id = ?',
    [adopted.treeId],
  );
  const root = rows[0];
  return root === undefined
    ? null
    : {
        kind: 'exists',
        treeId: adopted.treeId,
        autoAgentId: brandId<AgentId>({ value: root.root_agent_id }),
      };
};

export const adoptAgent = async ({
  db,
  sessionId,
  sourceAgentId,
  source,
  instruction,
  autoRouting,
  primaryMountId,
  capUsd,
  nowMs,
  newId,
}: AdoptAgentParams): Promise<AdoptOutcome> => {
  try {
    const earlier = await existingAdoption({ db, sourceAgentId });
    if (earlier !== null) {
      return earlier;
    }
    const agent = await getAgentById(db, sourceAgentId);
    const role = adoptionRoleOf({ kind: source.kind });
    const code = diagnoseAdoption({
      isGone: agent === null || agent.deletedAt != null || agent.sessionId !== sessionId,
      kind: source.kind,
      hasRunStep: agent !== null && (agent.workflowRunId != null || agent.stepId != null),
      isTurnLive: source.isTurnLive || agent?.status === 'running',
      isInAuto: false,
      isLinkedToAuto: false,
    });
    if (code !== null) {
      return refused({ code });
    }
    if (role === null) {
      return refused({ code: 'not_adoptable' });
    }
    const artifacts = (await listArtifactsForSession({ db, sessionId })).filter(
      (artifact) =>
        artifact.agentId === sourceAgentId &&
        artifact.status === 'active' &&
        (artifact.kind === 'plan' || artifact.kind === 'report'),
    );
    const registered: ReadonlyArray<AdoptedArtifact> = artifacts.flatMap((artifact) =>
      artifact.kind === 'plan' || artifact.kind === 'report'
        ? [{ artifactId: artifact.id, kind: artifact.kind }]
        : [],
    );
    const resultArtifacts: ReadonlyArray<ResultArtifact> = artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind === 'plan' ? 'plan' : 'report',
      title: artifact.title,
      contentHash: sha256Hex(artifact.sourceText),
      revision: artifact.revision,
      baseRevision: null,
    }));
    const treeId = brandId<AutoTreeId>({ value: newId() });
    const delegationId = brandId<AutoDelegationId>({ value: newId() });
    const autoAgentId = brandId<AgentId>({ value: newId() });
    const attemptId = newId();
    const kickoff = composeAdoptionKickoff({
      sourceName: agent?.name ?? 'the agent',
      roleLabel: source.roleLabel,
      goal: source.goal,
      lastReply: source.lastReply,
      artifacts: resultArtifacts.flatMap((artifact) =>
        artifact.kind === 'plan' || artifact.kind === 'report'
          ? [
              {
                id: artifact.id,
                kind: artifact.kind,
                title: artifact.title,
                revision: artifact.revision,
              },
            ]
          : [],
      ),
      mountLabel: source.mountLabel,
      instruction,
    });
    const result = buildAdoptedResult({
      delegationId,
      attemptId,
      treeId,
      childAgentId: sourceAgentId,
      role,
      routing: { provider: source.provider, model: source.model, effort: source.effort },
      summary: source.lastReply,
      artifacts: resultArtifacts,
    });
    for (let attempt = 0; attempt < MAX_ORDINAL_ATTEMPTS; attempt += 1) {
      const ordinal = await nextOrdinal({ db, sessionId });
      const outcome = await db.transaction({
        statements: adoptAgentStatements({
          sessionId,
          sourceAgentId,
          sourceRole: role,
          autoAgent: {
            id: autoAgentId,
            sessionId,
            ordinal,
            name: AUTO_AGENT_NAME,
            status: 'pending',
            kind: 'auto',
            modelOverride: autoRouting.model,
            providerOverride: autoRouting.provider,
            ...effortOf({ value: autoRouting.effort }),
          },
          treeId,
          primaryMountId,
          capUsd,
          hardDeadlineAt: nowMs + WALL_CLOCK_HOURS * HOUR_MS,
          delegation: {
            id: delegationId,
            requestId: `adopt-${sourceAgentId}`,
            batchId: `adopt-batch-${delegationId}`,
            attemptId,
            routing: {
              provider: source.provider,
              model: source.model,
              effort: source.effort,
            },
            request: {
              task: instruction.trim(),
              adopted: true,
              sourceAgentId,
              doneWhen: null,
              expected: null,
            },
            target: { mountId: primaryMountId },
            result,
          },
          artifacts: registered,
          outbox: {
            id: newId(),
            payload: {
              kind: 'user',
              text: kickoff,
              facts: {
                ...EMPTY_USER_FACTS,
                lastResultArtifactIds: resultArtifacts.map((artifact) => artifact.id),
              },
            },
          },
          nowMs,
        }),
      });
      if (outcome.status === 'committed') {
        return { kind: 'adopted', treeId, autoAgentId, delegationId };
      }
      const refusal = refusalOfAbort({ abortCode: outcome.abortCode });
      if (refusal === 'already_in_auto') {
        return (await existingAdoption({ db, sourceAgentId })) ?? refused({ code: refusal });
      }
      if (refusal !== null) {
        return refused({ code: refusal });
      }
    }
    return { kind: 'failed', message: 'Auto could not take this agent over. Try again.' };
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
};
