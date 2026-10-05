import { useEffect, useState } from 'react';
import type { ArtifactId } from '@goodboy/types';
import { ArtifactStudio } from '../../../../features/artifacts/components/ArtifactStudio';
import {
  REPORT_ARTIFACT_ID,
  SCOUTING_WIREFRAME_RUN_TITLE,
  SESSION_ID,
  WIREFRAME_HIGH_ARTIFACT_ID,
  WIREFRAME_LOW_ARTIFACT_ID,
  seedArtifactScene,
} from './artifactSeed';
import { PLAN_COMMENTS_ARTIFACT_ID, seedPlanCommentsScene } from './artifactCommentsSeed';

type Props = {
  readonly artifactId: ArtifactId | null;
  readonly openRunTitle?: string;
  readonly seed?: () => void;
};

const ArtifactScene = ({ artifactId, openRunTitle, seed }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const run = seed ?? (() => seedArtifactScene({ focusedArtifactId: artifactId }));
    run();
    setIsReady(true);
  }, [artifactId, seed]);

  useEffect(() => {
    if (!isReady || openRunTitle === undefined) {
      return;
    }
    const interval = window.setInterval(() => {
      const row = [...window.document.querySelectorAll('button')].find(
        (button) => button.getAttribute('aria-label')?.includes(openRunTitle) === true,
      );
      if (row === undefined) {
        return;
      }
      row.click();
      window.clearInterval(interval);
    }, 120);
    return () => window.clearInterval(interval);
  }, [isReady, openRunTitle]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="min-h-0 flex-1">
        <ArtifactStudio sessionId={SESSION_ID} />
      </div>
    </main>
  );
};

export const ArtifactReportScene = () => <ArtifactScene artifactId={REPORT_ARTIFACT_ID} />;

export const ArtifactWireframeLowScene = () => (
  <ArtifactScene artifactId={WIREFRAME_LOW_ARTIFACT_ID} />
);

export const ArtifactWireframeHighScene = () => (
  <ArtifactScene artifactId={WIREFRAME_HIGH_ARTIFACT_ID} />
);

export const ArtifactPlanCommentsScene = () => (
  <ArtifactScene artifactId={PLAN_COMMENTS_ARTIFACT_ID} seed={seedPlanCommentsScene} />
);

export const ArtifactGeneratingScene = () => (
  <ArtifactScene artifactId={null} openRunTitle={SCOUTING_WIREFRAME_RUN_TITLE} />
);
