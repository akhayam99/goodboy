import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { DrawerHost } from '../../../DrawerHost';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { shellArrangement } from '../../../../shellArrangement';
import { SESSION } from '../resolveSeed';
import { commentsTriageSeed, type CommentsTriagePhase } from './commentsTriageSeed';

const arrangement = shellArrangement({
  hasWorkspace: true,
  hasActiveSession: true,
  isSidebarCollapsed: false,
});

type Props = {
  readonly phase: CommentsTriagePhase;
};

export const CommentsTriageScene = ({ phase }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    commentsTriageSeed({ phase });
    setIsReady(true);
  }, [phase]);
  if (!isReady) {
    return null;
  }
  return (
    <div className="[&>div]:w-full" style={{ width: 1440 }}>
      <AppShell
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={<div aria-hidden />}
        main={<BranchPage session={SESSION} workingDir={null} />}
        drawer={<DrawerHost />}
        drawerSizing="side"
      />
    </div>
  );
};
