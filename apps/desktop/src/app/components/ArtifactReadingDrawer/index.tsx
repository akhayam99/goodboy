import { Suspense } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../store';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { ReportStudio } from '../../../features/reports/components/ReportStudio';
import { lazyNamed } from '../../../shared/lib/lazyNamed';
import { readingArtifactOf } from './readingArtifact';
import { ArtifactSkeleton } from './ArtifactSkeleton';

const WireframeViewer = lazyNamed({
  load: () => import('../../../features/wireframes/components/WireframeViewer'),
  pick: ({ WireframeViewer }) => WireframeViewer,
});

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
      page={{
        tooltip: 'Open in Artifacts',
        onOpen: () =>
          navigate({
            to: sessionPlace({
              sessionId,
              lens: 'plans',
              target: { kind: 'artifact', artifactId: artifact.id },
            }),
          }),
      }}
    >
      <div
        data-testid="artifact-reading-drawer"
        data-artifact-kind={artifact.kind}
        className="@container flex min-w-0 flex-col gap-4"
      >
        {artifact.kind === 'report' ? (
          <ReportStudio sessionId={sessionId} artifact={artifact} />
        ) : (
          <Suspense fallback={<ArtifactSkeleton />}>
            <WireframeViewer sessionId={sessionId} artifact={artifact} />
          </Suspense>
        )}
      </div>
    </DrawerFrame>
  );
};
