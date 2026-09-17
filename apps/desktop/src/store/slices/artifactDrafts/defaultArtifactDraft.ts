import type { IsoDateTime, MountId } from '@goodboy/types';
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
      attachments: [],
      mountIds: [],
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
    attachments: [],
    mountIds: [],
    basedOn: { kind: 'session' },
    routing: null,
    updatedAt: now,
  };
};

type MountChoiceParams = Readonly<{
  mountIds: ReadonlyArray<MountId>;
  defaultMountIds: ReadonlyArray<MountId>;
}>;

const isDefaultMountChoice = ({ mountIds, defaultMountIds }: MountChoiceParams): boolean => {
  if (mountIds.length !== defaultMountIds.length) {
    return false;
  }
  const defaults = new Set(defaultMountIds);
  return mountIds.every((mountId) => defaults.has(mountId));
};

type EmptyParams = Readonly<{
  draft: ArtifactCreationDraft;
  defaultMountIds: ReadonlyArray<MountId>;
}>;

export const isArtifactDraftEmpty = ({ draft, defaultMountIds }: EmptyParams): boolean => {
  if (draft.brief.trim().length > 0) {
    return false;
  }
  if (draft.attachments.length > 0) {
    return false;
  }
  if (!isDefaultMountChoice({ mountIds: draft.mountIds, defaultMountIds })) {
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
