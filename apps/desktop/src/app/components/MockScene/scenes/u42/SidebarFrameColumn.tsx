import { useEffect, useState } from 'react';
import { LEFT_SIDEBAR_DEFAULT } from '@goodboy/ui';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { shellArrangement } from '../../../../shellArrangement';
import { SideColumn } from '../../../SideColumn';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { useSceneShell } from '../useSceneShell';

const ARRANGEMENT = shellArrangement({ hasWorkspace: true, isSidebarCollapsed: false });

type Props = {
  readonly afterSeed: () => void;
};

export const SidebarFrameColumn = ({ afterSeed }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const shell = useSceneShell({ arrangement: ARRANGEMENT });

  useEffect(() => {
    seedBoardScene();
    afterSeed();
    setIsReady(true);
  }, [afterSeed]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-backdrop" style={{ width: LEFT_SIDEBAR_DEFAULT }}>
        <SideColumn
          scope={ARRANGEMENT.columnScope}
          workspaceId={WORKSPACE_ID}
          currentSessionId={null}
          place="board"
          actions={shell.actions}
        />
      </div>
      {shell.layers}
    </ToastProvider>
  );
};
