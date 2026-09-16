import { PROVIDER_IDS } from '@goodboy/types';
import type {
  AgentEffort,
  IsoDateTime,
  ProviderId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { GENERATED_ARTIFACT_KINDS } from '../../../features/artifacts/artifactCollection';
import { EFFORT_LEVELS } from '../../../features/chat/utils/chat-constants';
import { asReportType } from '../../../features/reports/reportTypes';
import { asWireframeFidelity } from '../../../features/wireframes/wireframeFidelity';
import { asWireframeTarget } from '../../../features/wireframes/wireframeTarget';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { DEFAULT_WIREFRAME_TARGET } from './defaultArtifactDraft';
import type {
  ArtifactBasedOn,
  ArtifactCreationDraft,
  ArtifactCreationRouting,
  SessionArtifactDrafts,
} from './types';

type Params = Readonly<{
  sessionId: SessionId;
}>;

type WriteParams = Params &
  Readonly<{
    drafts: SessionArtifactDrafts;
  }>;

const EPOCH = new Date(0).toISOString() as IsoDateTime;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const storageKey = ({ sessionId }: Params): string =>
  `${STORAGE_PREFIXES.artifactDrafts}${sessionId}`;

const readBasedOn = (value: unknown): ArtifactBasedOn => {
  if (!isRecord(value) || value['kind'] !== 'workflow-run') {
    return { kind: 'session' };
  }
  const runId = value['workflowRunId'];
  if (typeof runId !== 'string' || runId.length === 0) {
    return { kind: 'session' };
  }
  return { kind: 'workflow-run', workflowRunId: runId as WorkflowRunId };
};

const readRouting = (value: unknown): ArtifactCreationRouting | null => {
  if (!isRecord(value)) {
    return null;
  }
  const provider = PROVIDER_IDS.find((candidate) => candidate === value['provider']);
  const effort = EFFORT_LEVELS.find((candidate) => candidate === value['effort']);
  const model = value['model'];
  if (provider === undefined || effort === undefined || typeof model !== 'string') {
    return null;
  }
  return {
    provider: provider satisfies ProviderId,
    model,
    effort: effort satisfies AgentEffort,
  };
};

const readDraft = (value: unknown): ArtifactCreationDraft | null => {
  if (!isRecord(value)) {
    return null;
  }
  const base = {
    brief: typeof value['brief'] === 'string' ? value['brief'] : '',
    basedOn: readBasedOn(value['basedOn']),
    routing: readRouting(value['routing']),
    updatedAt: typeof value['updatedAt'] === 'string' ? (value['updatedAt'] as IsoDateTime) : EPOCH,
  };
  if (value['kind'] === 'report') {
    const reportType = asReportType({ value: String(value['reportType'] ?? '') });
    return reportType === null ? null : { ...base, kind: 'report', reportType };
  }
  if (value['kind'] === 'wireframe') {
    const fidelity = asWireframeFidelity({ value: String(value['fidelity'] ?? '') });
    const target =
      asWireframeTarget({ value: String(value['target'] ?? '') }) ?? DEFAULT_WIREFRAME_TARGET;
    return fidelity === null ? null : { ...base, kind: 'wireframe', fidelity, target };
  }
  return null;
};

export const readFromStorage = ({ sessionId }: Params): SessionArtifactDrafts => {
  try {
    const raw = localStorage.getItem(storageKey({ sessionId }));
    if (raw === null) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed['v'] !== 1) {
      return {};
    }
    return GENERATED_ARTIFACT_KINDS.reduce<SessionArtifactDrafts>((acc, kind) => {
      const draft = readDraft(parsed[kind]);
      return draft === null || draft.kind !== kind ? acc : { ...acc, [kind]: draft };
    }, {});
  } catch {
    return {};
  }
};

export const writeToStorage = ({ sessionId, drafts }: WriteParams): void => {
  try {
    const kept = GENERATED_ARTIFACT_KINDS.reduce<Record<string, ArtifactCreationDraft>>(
      (acc, kind) => {
        const draft = drafts[kind];
        return draft === undefined ? acc : { ...acc, [kind]: draft };
      },
      {},
    );
    if (Object.keys(kept).length === 0) {
      localStorage.removeItem(storageKey({ sessionId }));
      return;
    }
    localStorage.setItem(storageKey({ sessionId }), JSON.stringify({ v: 1, ...kept }));
  } catch {
    return;
  }
};
