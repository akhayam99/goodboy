import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SESSION } from '../resolveSeed';
import { applyChecksSeed, type ChecksVariant } from './checksSeed';

type Props = {
  readonly variant: ChecksVariant;
};

export const ChecksScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyChecksSeed({ variant });
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <BranchPage session={SESSION} workingDir={null} />
    </main>
  );
};
