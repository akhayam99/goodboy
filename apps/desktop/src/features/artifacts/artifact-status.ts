import type { ArtifactKind, ArtifactStatus } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export const ARTIFACT_STATUS_PRESENTATION = {
  active: {
    label: 'active',
    reason: 'the current revision of this artifact',
    tone: 'info',
    icon: CONCEPT_ICONS.plans,
  },
  consumed: {
    label: 'consumed',
    reason: 'an agent already executed it',
    tone: 'merged',
    icon: CONCEPT_ICONS.runDone,
  },
  superseded: {
    label: 'superseded',
    reason: 'a newer revision replaced it',
    tone: 'neutral',
    icon: CONCEPT_ICONS.changelog,
  },
  discarded: {
    label: 'discarded',
    reason: 'dropped, kept for reference only',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runCancelled,
  },
} satisfies Record<ArtifactStatus, StatePresentation>;

const PLAN_LIFECYCLE_STATUSES: ReadonlyArray<ArtifactStatus> = ['active', 'consumed'];

export const describeArtifactStatus = ({
  kind,
  status,
}: {
  readonly kind: ArtifactKind;
  readonly status: ArtifactStatus;
}): StatePresentation | null => {
  if (kind === 'plan') {
    return ARTIFACT_STATUS_PRESENTATION[status];
  }
  return PLAN_LIFECYCLE_STATUSES.includes(status) ? null : ARTIFACT_STATUS_PRESENTATION[status];
};

export const ARTIFACT_KIND_LABEL: Record<ArtifactKind, string> = {
  plan: 'Plans',
  report: 'Reports',
  wireframe: 'Wireframes',
};
