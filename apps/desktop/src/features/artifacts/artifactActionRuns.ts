import { save } from '@tauri-apps/plugin-dialog';
import { parseWireframeSource } from '@goodboy/core';
import type {
  IsoDateTime,
  ReportArtifact,
  SessionArtifact,
  SessionId,
  WireframeArtifact,
} from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { asReportType } from '../reports/reportTypes';
import { asWireframeFidelity, type WireframeFidelity } from '../wireframes/wireframeFidelity';
import { deriveWireframeTarget } from '../wireframes/wireframeTarget';
import { openWireframeInBrowser } from '../wireframes/openWireframeInBrowser';
import { exportArtifactToFile } from './artifactFile';
import { artifactFolderName } from './artifactFolderName';
import { openArtifactMirror, revealArtifactMirror } from './artifactMirror/artifactMirrorInvoke';
import { loadArtifactProvenance } from './artifactProvenance';
import { ARTIFACT_RETRY_MISSING_BRIEF, artifactRetryDraft } from './artifactRetryDraft';
import type { ArtifactGeneration } from './artifactCollection';
import { artifactFileSlug } from './hooks/useArtifactExport/artifactFileSlug';
import { openAgentRevealEvent } from '../../shared/utils/openAgentReveal';
import {
  artifactExportContents,
  artifactSourceExport,
} from './hooks/useArtifactExport/artifactSourceExport';

const MIRROR_INDEX_FILE = 'index.html';

type ArtifactParams = {
  readonly artifact: SessionArtifact;
};

export const artifactSourceContents = ({ artifact }: ArtifactParams): string =>
  artifactExportContents({ sourceFormat: artifact.sourceFormat, sourceText: artifact.sourceText });

export const saveArtifactSource = async ({ artifact }: ArtifactParams): Promise<string | null> => {
  const descriptor = artifactSourceExport({ sourceFormat: artifact.sourceFormat });
  const target = await save({
    defaultPath: `${artifactFileSlug({ title: artifact.title })}.${descriptor.fileExtension}`,
    filters: [{ name: descriptor.filterName, extensions: [...descriptor.filterExtensions] }],
  });
  if (target === null || target === '') {
    return null;
  }
  return exportArtifactToFile({ path: target, contents: artifactSourceContents({ artifact }) });
};

type MirrorParams = ArtifactParams & {
  readonly workspaceSlug: string;
};

export const openArtifactCopy = async ({
  artifact,
  workspaceSlug,
}: MirrorParams): Promise<void> => {
  if (artifact.kind === 'wireframe') {
    await openWireframeInBrowser({
      artifact,
      workspaceSlug,
      screenId: null,
    });
    return;
  }
  await openArtifactMirror({
    workspaceSlug,
    folder: artifactFolderName({ artifact }),
    file: MIRROR_INDEX_FILE,
  });
};

export const revealArtifactCopy = ({ artifact, workspaceSlug }: MirrorParams): Promise<void> =>
  revealArtifactMirror({ workspaceSlug, folder: artifactFolderName({ artifact }) });

type StoreParams = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
};

export const artifactKickoff = ({
  getState,
  artifact,
}: {
  readonly getState: () => AppStore;
  readonly artifact: SessionArtifact;
}): string | null => {
  const first = (getState().transcripts[artifact.agentId] ?? []).find(
    (event) => event.kind === 'user_text',
  );
  return first?.kind === 'user_text' && first.text.trim() !== '' ? first.text : null;
};

export const regenerateReport = async ({
  getState,
  sessionId,
  artifact,
  kickoff,
}: StoreParams & {
  readonly artifact: ReportArtifact;
  readonly kickoff: string;
}): Promise<void> => {
  await getState().spawnReportAgent({
    sessionId,
    reportType: asReportType({ value: artifact.metadata.reportType }) ?? 'session-summary',
    workflowRunId: artifact.workflowRunId,
    attachments: [],
    evidence: kickoff,
  });
  window.dispatchEvent(openAgentRevealEvent());
};

type WireframeParams = {
  readonly artifact: WireframeArtifact;
};

export const otherWireframeFidelity = ({ artifact }: WireframeParams): WireframeFidelity =>
  (asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low') === 'low' ? 'high' : 'low';

export const spawnWireframeVariant = async ({
  getState,
  sessionId,
  artifact,
}: StoreParams & WireframeParams): Promise<void> => {
  const parsed = parseWireframeSource({ source: artifact.sourceText });
  const target =
    parsed.status === 'valid'
      ? (deriveWireframeTarget({ screens: parsed.document.screens }) ?? 'both')
      : 'both';
  await getState().spawnWireframeAgent({
    sessionId,
    fidelity: otherWireframeFidelity({ artifact }),
    target,
    workflowRunId: artifact.workflowRunId,
    attachments: [],
  });
  window.dispatchEvent(openAgentRevealEvent());
};

export const retryArtifactGeneration = async ({
  getState,
  sessionId,
  generation,
}: StoreParams & { readonly generation: ArtifactGeneration }): Promise<void> => {
  const provenance = await loadArtifactProvenance(generation.agentId).catch(() => null);
  const now = new Date().toISOString() as IsoDateTime;
  getState().setArtifactDraft({
    sessionId,
    draft: artifactRetryDraft({ generation, provenance, now }),
  });
  getState().openArtifactCreation({
    sessionId,
    kind: generation.kind,
    workflowRunId: provenance?.sourceWorkflowRunId ?? null,
    note: provenance === null ? ARTIFACT_RETRY_MISSING_BRIEF : null,
  });
};
