import { ArrowUpRight } from 'lucide-react';
import { DrawerFrame, IconButton } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { ReportStudio } from '../../../features/reports/components/ReportStudio';
import { WireframeViewer } from '../../../features/wireframes/components/WireframeViewer';
import { readingArtifactOf } from './readingArtifact';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly onClose: () => void;
};

export const ArtifactReadingDrawer = ({ sessionId, artifactId, onClose }: Props) => {
  const artifact = useAppStore((s) => readingArtifactOf({ state: s, sessionId, artifactId }));
  const navigate = useAppStore((s) => s.navigate);

  if (artifact === null) {
    return null;
  }

  return (
    <DrawerFrame
      title={artifact.title}
      icon={CONCEPT_ICONS.artifacts}
      iconClassName="text-muted-foreground"
      count={`v${artifact.revision}`}
      onClose={onClose}
      action={
        <IconButton
          icon={ArrowUpRight}
          iconSize={ICON_SIZE.row}
          label="Open in Artifacts"
          variant="ghost"
          onClick={() =>
            navigate({
              to: sessionPlace({
                sessionId,
                lens: 'plans',
                target: { kind: 'artifact', artifactId: artifact.id },
              }),
            })
          }
        />
      }
    >
      <div
        data-testid="artifact-reading-drawer"
        data-artifact-kind={artifact.kind}
        className="@container flex min-w-0 flex-col gap-4"
      >
        {artifact.kind === 'report' ? (
          <ReportStudio sessionId={sessionId} artifact={artifact} />
        ) : (
          <WireframeViewer sessionId={sessionId} artifact={artifact} />
        )}
      </div>
    </DrawerFrame>
  );
};
