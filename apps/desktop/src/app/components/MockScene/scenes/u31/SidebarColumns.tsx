import type { Session } from '@goodboy/types';
import { shellArrangement } from '../../../../shellArrangement';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { useSceneShell } from '../useSceneShell';

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
        <ShellLeft
          arrangement={ARRANGEMENT}
          workspaceId={session.workspaceId}
          currentSessionId={session.id}
          isDraftShown={false}
          actions={shell.actions}
          settingsSlotRef={shell.settingsSlotRef}
        />
      </div>
      <div style={{ width: COLUMN_WIDTH }}>
        <SessionFrame session={session}>
          <div />
        </SessionFrame>
      </div>
    </div>
  );
};
