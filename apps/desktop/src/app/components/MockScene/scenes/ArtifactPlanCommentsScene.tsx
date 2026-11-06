import { useEffect, useState } from 'react';
import { ArtifactStudio } from '../../../../features/artifacts/components/ArtifactStudio';
import { SESSION_ID } from './artifactSeed';
import { seedPlanCommentsScene } from './artifactCommentsSeed';

type Props = {
  readonly hasComments?: boolean;
  readonly hasRun?: boolean;
};

export const ArtifactPlanCommentsScene = ({ hasComments = true, hasRun = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedPlanCommentsScene({ hasComments, hasRun });
    setIsReady(true);
  }, [hasComments, hasRun]);

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
