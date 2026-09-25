import type { ArtifactKind, ArtifactStatus } from '@goodboy/types';
import { PLAN_STATUS_PRESENTATION } from '../plans/plan-status';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export const ARTIFACT_STATUS_PRESENTATION = {
  superseded: PLAN_STATUS_PRESENTATION.superseded,
  discarded: {
    label: 'Discarded',
    reason: 'dropped, kept for reference only',
    tone: 'neutral',
    icon: PLAN_STATUS_PRESENTATION.discarded.icon,
  },
} satisfies Record<Exclude<ArtifactStatus, 'active' | 'consumed'>, StatePresentation>;

export const describeArtifactStatus = ({
  kind,
  status,
}: {
  readonly kind: ArtifactKind;
  readonly status: ArtifactStatus;
}): StatePresentation | null => {
  if (kind === 'plan') {
    return PLAN_STATUS_PRESENTATION[status];
  }
  if (status === 'active' || status === 'consumed') {
    return null;
  }
  return ARTIFACT_STATUS_PRESENTATION[status];
};

export const ARTIFACT_KIND_LABEL: Record<ArtifactKind, string> = {
  plan: 'Plans',
  report: 'Reports',
  wireframe: 'Wireframes',
};
