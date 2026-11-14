import { useMemo } from 'react';
import type { ColumnActions } from '../../components/SideColumn/columnDoors';
import { openDestination } from '../../../shared/navigation/openDestination';

type Params = Omit<ColumnActions, 'openWork'>;

const openWork = (): void => openDestination({ id: 'work' });

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
      openWork,
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
