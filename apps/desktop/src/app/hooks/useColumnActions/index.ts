import { useMemo } from 'react';
import type { ColumnActions } from '../../components/SideColumn/columnDoors';

type Params = ColumnActions;

export const useColumnActions = ({
  openBoard,
  openInbox,
  openChat,
  openWorkflows,
  openTerminalStudio,
  openBrowserStudio,
  openNewChat,
  openMonitoring,
  openImpact,
  openSettings,
  openChangelog,
  openGuide,
  openShortcuts,
}: Params): ColumnActions =>
  useMemo(
    () => ({
      openBoard,
      openInbox,
      openChat,
      openWorkflows,
      openTerminalStudio,
      openBrowserStudio,
      openNewChat,
      openMonitoring,
      openImpact,
      openSettings,
      openChangelog,
      openGuide,
      openShortcuts,
    }),
    [
      openBoard,
      openInbox,
      openChat,
      openWorkflows,
      openTerminalStudio,
      openBrowserStudio,
      openNewChat,
      openMonitoring,
      openImpact,
      openSettings,
      openChangelog,
      openGuide,
      openShortcuts,
    ],
  );
