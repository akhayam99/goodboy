import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SESSION } from '../resolveSeed';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { bResolveStateSeed, type ResolveStateVariant } from './bResolveStateSeed';

type Props = {
  readonly variant: ResolveStateVariant;
};

export const BResolveStateScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    bResolveStateSeed({ variant });
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={SESSION} workingDir={null} />
      </WorktreeSceneColumn>
    </main>
  );
};
