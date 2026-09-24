import { ActionTile } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { hasArtifactEvidence } from '../../../artifacts/artifactCtaState';
import { reportCreationAdapter } from '../../reportCreationAdapter';

type Props = {
  readonly sessionId: SessionId;
  readonly className?: string;
  readonly onOpen: () => void;
};

export const ReportTile = ({ sessionId, className, onOpen }: Props) => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const hasEvidence = hasArtifactEvidence({ agents });

  if (!hasEvidence) {
    return null;
  }

  return (
    <ActionTile
      icon={<CONCEPT_ICONS.changelog size={ICON_SIZE.hero} aria-hidden className="text-info" />}
      title="Create report"
      description={reportCreationAdapter.ctaTitle}
      testId="create-report-cta"
      className={className}
      onClick={onOpen}
    />
  );
};
