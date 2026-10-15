import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { START_HINT_SCOPES } from '../../../../../store/slices/startHints/startHintScopes';
import { DrawerHost } from '../../../DrawerHost';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { shellArrangement } from '../../../../shellArrangement';
import { SESSION } from '../resolveSeed';
import { fixCommentsSeed, type FixCommentsPhase } from './fixCommentsSeed';

const arrangement = shellArrangement({
  hasWorkspace: true,
  isSidebarCollapsed: false,
});

type Props = {
  readonly phase: FixCommentsPhase;
  readonly hint?: string;
};

export const FixCommentsScene = ({ phase, hint }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    fixCommentsSeed({ phase });
    if (hint !== undefined) {
      useAppStore
        .getState()
        .setStartHint({ sessionId: SESSION.id, scope: START_HINT_SCOPES.fixComments, text: hint });
    }
    setIsReady(true);
  }, [phase, hint]);
  if (!isReady) {
    return null;
  }
  return (
    <div className="[&>div]:w-full" style={{ width: 1440 }}>
      <AppShell
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={<div aria-hidden />}
        main={<BranchPage session={SESSION} workingDir={null} />}
        drawer={<DrawerHost />}
        drawerSizing="side"
      />
    </div>
  );
};
