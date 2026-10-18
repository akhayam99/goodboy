import { useEffect, useState } from 'react';
import { useSessionById } from '../../../../../store';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { SideColumn } from '../../../SideColumn';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { C09_SESSION_ID, C09_WORKSPACE_ID } from '../u25/c09OrchestratedSeed';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { seedIntros, type IntroPage } from './introsSeed';

type Props = {
  readonly page: IntroPage;
  readonly isEmpty: boolean;
  readonly hoverMarker?: 'auto';
  readonly theme?: 'dark' | 'light';
};

const HOVER_DELAY_MS = 1_500;

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openTerminalStudio: noop,
  openNewChat: noop,
  openNewTerminal: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
  openShortcuts: noop,
};

export const IntrosScene = ({ page, isEmpty, hoverMarker, theme }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(C09_SESSION_ID);

  useEffect(() => {
    if (theme !== undefined) {
      applyDocumentTheme({ theme });
    }
    seedIntros({ page, isEmpty });
    setIsSeeded(true);
  }, [page, isEmpty, theme]);

  useEffect(() => {
    if (!isSeeded || hoverMarker === undefined) {
      return;
    }
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-testid="page-marker-${hoverMarker}"]`)
        ?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }, HOVER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isSeeded, hoverMarker]);

  if (!isSeeded || session === null) {
    return null;
  }

  return (
    <div data-shot className="flex h-screen min-h-0 bg-background text-foreground">
      <div className="h-full w-60 shrink-0 border-r border-border-soft">
        <SideColumn
          scope="workspace"
          workspaceId={C09_WORKSPACE_ID}
          currentSessionId={session.id}
          place={null}
          actions={ACTIONS}
        />
      </div>
      <main className="relative flex min-w-0 flex-1">
        <SessionFrame session={session}>
          <SessionWorkspace session={session} isActive />
        </SessionFrame>
      </main>
    </div>
  );
};
