import type { Session } from '@goodboy/types';
import { shellArrangement } from '../../../../../shellArrangement';
import { ShellLeft } from '../../../../ShellLeft';
import { SessionContextCards } from '../../../../SessionContextCards';
import { useSceneShell } from '../../useSceneShell';

const COLUMN_WIDTH = 244;
const COLUMN_HEIGHT = 560;

const ARRANGEMENT = shellArrangement({ hasWorkspace: true });

type Props = {
  readonly session: Session;
};

export const SidebarColumns = ({ session }: Props) => {
  const shell = useSceneShell({});
  return (
    <div className="flex" style={{ height: COLUMN_HEIGHT }}>
      <ShellLeft
        arrangement={ARRANGEMENT}
        workspaceId={session.workspaceId}
        actions={shell.actions}
      />
      <div style={{ width: COLUMN_WIDTH }}>
        <SessionContextCards session={session} />
      </div>
    </div>
  );
};
