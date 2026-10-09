import { useEffect, useState } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { SESSION } from '../resolveSeed';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from '../audit/workspaceChrome';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedCommentsScene, type CommentsVariant } from './commentsSeed';

type Props = {
  readonly variant: CommentsVariant;
};

export const CommentsScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedCommentsScene({ variant });
    if (variant === 'push-failed') {
      seedWorkspaceChrome({ session: SESSION, siblings: WORKSPACE_SIBLINGS });
    }
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  const page = <BranchPage session={SESSION} workingDir={null} />;

  if (variant === 'push-failed') {
    return <WorkspaceFrame session={SESSION} main={<div className="h-full w-full">{page}</div>} />;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto h-full">{page}</div>
    </main>
  );
};
