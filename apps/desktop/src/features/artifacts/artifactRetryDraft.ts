import type { ArtifactProvenance, IsoDateTime } from '@goodboy/types';
import { defaultArtifactDraft } from '../../store/slices/artifactDrafts/defaultArtifactDraft';
import type { ArtifactCreationDraft } from '../../store/slices/artifactDrafts/types';
import { REPORT_TYPES, REPORT_TYPE_LABEL } from '../reports/reportTypes';
import { WIREFRAME_FIDELITIES, WIREFRAME_FIDELITY_LABEL } from '../wireframes/wireframeFidelity';
import type { ArtifactGeneration } from './artifactCollection';

export const ARTIFACT_RETRY_MISSING_BRIEF = 'the brief of this generation was not recorded';

type Params = Readonly<{
  generation: ArtifactGeneration;
  provenance: ArtifactProvenance | null;
  now: IsoDateTime;
}>;

export const artifactRetryDraft = ({
  generation,
  provenance,
  now,
}: Params): ArtifactCreationDraft => {
  const base = defaultArtifactDraft({ kind: generation.kind, now });
  const brief = provenance?.brief ?? '';
  const sourceRunId = provenance?.sourceWorkflowRunId ?? null;
  const basedOn: ArtifactCreationDraft['basedOn'] =
    sourceRunId === null
      ? { kind: 'session' }
      : { kind: 'workflow-run', workflowRunId: sourceRunId };
  if (base.kind === 'report') {
    const reportType = REPORT_TYPES.find(
      (candidate) => REPORT_TYPE_LABEL[candidate] === generation.title,
    );
    return { ...base, brief, basedOn, ...(reportType !== undefined && { reportType }) };
  }
  const fidelity = WIREFRAME_FIDELITIES.find(
    (candidate) => WIREFRAME_FIDELITY_LABEL[candidate] === generation.title,
  );
  return { ...base, brief, basedOn, ...(fidelity !== undefined && { fidelity }) };
};
