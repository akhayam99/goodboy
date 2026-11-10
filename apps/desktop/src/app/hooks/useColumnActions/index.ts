import { useMemo } from 'react';
import type { ColumnActions } from '../../components/SideColumn/columnDoors';

type Params = ColumnActions;

export const useColumnActions = ({
  openBoard,
  openInbox,
  openChat,
  openWorkflows,
  openNewChat,
  openMonitoring,
  openImpact,
  openSettings,
  openChangelog,
  openGuide,
}: Params): ColumnActions =>
  useMemo(
    () => ({
      openBoard,
      openInbox,
      openChat,
      openWorkflows,
      openNewChat,
      openMonitoring,
      openImpact,
      openSettings,
      openChangelog,
      openGuide,
    }),
    [
      openBoard,
      openInbox,
      openChat,
      openWorkflows,
      openNewChat,
      openMonitoring,
      openImpact,
      openSettings,
      openChangelog,
      openGuide,
    ],
  );
