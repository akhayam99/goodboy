import { AppShell } from '@goodboy/ui';
import { AppTopBar } from '../../../AppTopBar';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { useAppStore, useCurrentSession, useSessions } from '../../../../../store';
import { shellArrangement } from '../../../../shellArrangement';
import { WORKSPACE_ID } from '../BoardScene';
import { useSceneShell } from '../useSceneShell';
import { useSceneSidebar } from '../useSceneSidebar';
import { DemoIssueMain } from './DemoIssueMain';

const noop = () => undefined;

export const DemoIssueShell = () => {
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const isDraftOpen = useAppStore((state) => state.openSessionDraftWorkspaceId === WORKSPACE_ID);
  const rail = useSceneSidebar({ isCollapsed: false });
  const arrangement = shellArrangement({
    hasWorkspace: true,
    isSidebarCollapsed: rail.isCollapsed,
  });
  const shell = useSceneShell({ arrangement, onToggleSidebar: rail.toggle });
  const session = isDraftOpen ? null : currentSession;

  return (
    <>
      <AppShell
        studio={shell.studio}
        studioCoversLeft={arrangement.studioCoversLeft}
        topBar={
          <AppTopBar
            sidebar={{ isCollapsed: arrangement.isLeftRail, onToggle: rail.toggle }}
            onOpenSpend={noop}
            onOpenScript={noop}
          />
        }
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={WORKSPACE_ID}
            currentSessionId={session?.id ?? null}
            isDraftShown={isDraftOpen}
            actions={shell.actions}
            settingsSlotRef={shell.settingsSlotRef}
            {...(shell.isStudioOpen || session !== null || isDraftOpen
              ? {}
              : { placeOverride: 'board' as const })}
          />
        }
        main={<DemoIssueMain isDraftOpen={isDraftOpen} session={session} sessions={sessions} />}
      />
      {shell.layers}
    </>
  );
};
