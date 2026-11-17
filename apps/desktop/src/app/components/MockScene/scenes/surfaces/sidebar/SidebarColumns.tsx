import type { Session } from '@goodboy/types';
import { shellArrangement } from '../../../../../shellArrangement';
import { SideColumn } from '../../../../SideColumn';
import { SessionContextCards } from '../../../../SessionContextCards';
import { useSceneShell } from '../../useSceneShell';

const COLUMN_WIDTH = 244;
const COLUMN_HEIGHT = 560;

const ARRANGEMENT = shellArrangement({ hasWorkspace: true, isSidebarCollapsed: false });

type Props = {
  readonly session: Session;
};

export const SidebarColumns = ({ session }: Props) => {
  const shell = useSceneShell({ arrangement: ARRANGEMENT });
  return (
    <div className="flex" style={{ height: COLUMN_HEIGHT }}>
      <div style={{ width: COLUMN_WIDTH }}>
        <SideColumn
          scope={ARRANGEMENT.columnScope}
          workspaceId={session.workspaceId}
          currentSessionId={session.id}
          place={null}
          actions={shell.actions}
        />
      </div>
      <div style={{ width: COLUMN_WIDTH }}>
        <SessionContextCards session={session} />
      </div>
    </div>
  );
};
