import type { IsoDateTime } from '@goodboy/types';
import type { GeneratedArtifactKind } from '../../../features/artifacts/artifactCollection';
import type { ArtifactCreationDraft } from './types';

export const DEFAULT_REPORT_TYPE = 'session-summary';

export const DEFAULT_WIREFRAME_FIDELITY = 'low';

export const DEFAULT_WIREFRAME_TARGET = 'both';

type Params = Readonly<{
  kind: GeneratedArtifactKind;
  now: IsoDateTime;
}>;

export const defaultArtifactDraft = ({ kind, now }: Params): ArtifactCreationDraft => {
  if (kind === 'report') {
    return {
      kind: 'report',
      reportType: DEFAULT_REPORT_TYPE,
      brief: '',
      basedOn: { kind: 'session' },
      routing: null,
      updatedAt: now,
    };
  }
  return {
    kind: 'wireframe',
    fidelity: DEFAULT_WIREFRAME_FIDELITY,
    target: DEFAULT_WIREFRAME_TARGET,
    brief: '',
    basedOn: { kind: 'session' },
    routing: null,
    updatedAt: now,
  };
};

export const isArtifactDraftEmpty = ({
  draft,
}: {
  readonly draft: ArtifactCreationDraft;
}): boolean => {
  if (draft.brief.trim().length > 0) {
    return false;
  }
  if (draft.basedOn.kind !== 'session' || draft.routing !== null) {
    return false;
  }
  if (draft.kind === 'report') {
    return draft.reportType === DEFAULT_REPORT_TYPE;
  }
  return draft.fidelity === DEFAULT_WIREFRAME_FIDELITY && draft.target === DEFAULT_WIREFRAME_TARGET;
};
