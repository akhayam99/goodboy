import type {
  Agent,
  AgentId,
  ArtifactEvidenceSource,
  ArtifactKind,
  ArtifactProvenance,
  ArtifactRunPhase,
  ArtifactRunTarget,
  ArtifactScoutPlanEntry,
  MountId,
  Session,
  SessionArtifact,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  getArtifactProvenance as dbGetArtifactProvenance,
  putArtifactProvenance as dbPutArtifactProvenance,
  updateArtifactRun as dbUpdateArtifactRun,
} from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';
import { redactSecrets } from '../../shared/utils/redactSecrets';

export type ArtifactEvidenceInventoryArgs = {
  readonly sourceIds: ReadonlyArray<string>;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly sourceWorkflowRunId: WorkflowRunId | null;
};

const label = (value: string, fallback: string): string => {
  const trimmed = redactSecrets({ text: value }).trim();
  return trimmed.length === 0 ? fallback : trimmed;
};

export const artifactEvidenceInventory = ({
  sourceIds,
  session,
  agents,
  artifacts,
  sourceWorkflowRunId,
}: ArtifactEvidenceInventoryArgs): ReadonlyArray<ArtifactEvidenceSource> => {
  const seen = new Set<string>();
  const entries: Array<ArtifactEvidenceSource> = [];
  for (const id of sourceIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    if (id === session.id) {
      entries.push({ kind: 'session', id, label: label(session.goal, 'this session') });
      continue;
    }
    const agent = agents.find((entry) => entry.id === id);
    if (agent !== undefined) {
      entries.push({ kind: 'agent', id, label: label(agent.name, 'unnamed agent') });
      continue;
    }
    const artifact = artifacts.find((entry) => entry.id === id);
    if (artifact !== undefined) {
      entries.push({
        kind: 'artifact',
        id,
        label: `${artifact.kind}: ${label(artifact.title, 'untitled')}`,
      });
      continue;
    }
    if (sourceWorkflowRunId !== null && id === sourceWorkflowRunId) {
      entries.push({ kind: 'workflow-run', id, label: 'workflow run' });
      continue;
    }
    entries.push({ kind: 'unknown', id, label: id });
  }
  return entries;
};

export type RecordArtifactProvenanceArgs = {
  readonly agentId: AgentId;
  readonly sessionId: SessionId;
  readonly kind: ArtifactKind;
  readonly brief: string | null;
  readonly evidence: ReadonlyArray<ArtifactEvidenceSource>;
  readonly omissions: ReadonlyArray<string>;
  readonly designProfileSummary: string | null;
  readonly hasDesignEvidence: boolean;
  readonly phase: ArtifactRunPhase;
  readonly scoutPlan: ReadonlyArray<ArtifactScoutPlanEntry>;
  readonly mountIds: ReadonlyArray<MountId>;
  readonly target: ArtifactRunTarget | null;
  readonly deadlineAt: number | null;
  readonly sourceWorkflowRunId: WorkflowRunId | null;
  readonly executingWorkflowRunId: WorkflowRunId | null;
};

export const recordArtifactProvenance = async (
  args: RecordArtifactProvenanceArgs,
): Promise<void> => {
  const brief = args.brief?.trim() ?? '';
  await dbPutArtifactProvenance({
    db: tauriDatabase,
    input: {
      agentId: args.agentId,
      sessionId: args.sessionId,
      kind: args.kind,
      brief: brief.length === 0 ? null : redactSecrets({ text: brief }),
      evidence: args.evidence,
      omissions: args.omissions.map((note) => redactSecrets({ text: note })),
      designProfileSummary:
        args.designProfileSummary === null
          ? null
          : redactSecrets({ text: args.designProfileSummary }),
      hasDesignEvidence: args.hasDesignEvidence,
      phase: args.phase,
      scoutPlan: args.scoutPlan,
      mountIds: args.mountIds,
      target: args.target,
      deadlineAt: args.deadlineAt,
      sourceWorkflowRunId: args.sourceWorkflowRunId,
      executingWorkflowRunId: args.executingWorkflowRunId,
    },
  });
};

export type AdvanceArtifactRunArgs = {
  readonly agentId: AgentId;
  readonly phase: ArtifactRunPhase;
  readonly scoutPlan: ReadonlyArray<ArtifactScoutPlanEntry>;
};

export const advanceArtifactRun = async ({
  agentId,
  phase,
  scoutPlan,
}: AdvanceArtifactRunArgs): Promise<void> => {
  await dbUpdateArtifactRun({ db: tauriDatabase, input: { agentId, phase, scoutPlan } });
};

export const completeArtifactRun = async ({
  agentId,
}: Readonly<{ agentId: AgentId }>): Promise<void> => {
  const current = await dbGetArtifactProvenance({ db: tauriDatabase, agentId });
  if (current === null) {
    return;
  }
  if (current.phase !== 'gathering' && current.phase !== 'producing') {
    return;
  }
  await dbUpdateArtifactRun({
    db: tauriDatabase,
    input: { agentId, phase: 'done', scoutPlan: current.scoutPlan },
  });
};

export const loadArtifactProvenance = async (
  agentId: AgentId,
): Promise<ArtifactProvenance | null> => dbGetArtifactProvenance({ db: tauriDatabase, agentId });

export type AppendArtifactOmissionArgs = {
  readonly agentId: AgentId;
  readonly note: string;
};

export const appendArtifactProvenanceOmission = async ({
  agentId,
  note,
}: AppendArtifactOmissionArgs): Promise<void> => {
  const current = await dbGetArtifactProvenance({ db: tauriDatabase, agentId });
  if (current === null || current.omissions.includes(note)) {
    return;
  }
  await dbPutArtifactProvenance({
    db: tauriDatabase,
    input: {
      agentId,
      sessionId: current.sessionId,
      kind: current.kind,
      brief: current.brief,
      evidence: current.evidence,
      omissions: [...current.omissions, note],
      designProfileSummary: current.designProfileSummary,
      hasDesignEvidence: current.hasDesignEvidence,
      phase: current.phase,
      scoutPlan: current.scoutPlan,
      mountIds: current.mountIds,
      target: current.target,
      deadlineAt: current.deadlineAt,
      sourceWorkflowRunId: current.sourceWorkflowRunId,
      executingWorkflowRunId: current.executingWorkflowRunId,
    },
  });
};
