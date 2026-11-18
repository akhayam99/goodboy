import { useEffect, useState } from 'react';
import { useSessionById } from '../../../../../store';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { ShellLeft } from '../../../ShellLeft';
import { shellArrangement } from '../../../../shellArrangement';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import type { ColumnActions } from '../../../ShellLeft/columnDoors';
import { C09_SESSION_ID, C09_WORKSPACE_ID } from '../u25/c09OrchestratedSeed';
import { seedIntros, type IntroPage } from './introsSeed';

type Props = {
  readonly page: IntroPage;
  readonly isEmpty: boolean;
};

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openNewChat: noop,
  openConnections: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
};

export const IntrosScene = ({ page, isEmpty }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(C09_SESSION_ID);

  useEffect(() => {
    seedIntros({ page, isEmpty });
    setIsSeeded(true);
  }, [page, isEmpty]);

  if (!isSeeded || session === null) {
    return null;
  }

  return (
    <div data-shot className="flex h-screen min-h-0 bg-background text-foreground">
      <ShellLeft
        arrangement={shellArrangement({ hasWorkspace: true })}
        workspaceId={C09_WORKSPACE_ID}
        actions={ACTIONS}
      />
      <main className="relative flex min-w-0 flex-1">
        <SessionFrame session={session}>
          <SessionWorkspace session={session} />
        </SessionFrame>
      </main>
    </div>
  );
};
