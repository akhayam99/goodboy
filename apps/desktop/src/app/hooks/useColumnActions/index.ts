import { useMemo } from 'react';
import type { ColumnActions } from '../../components/ShellLeft/columnDoors';
import { openDestination } from '../../../shared/navigation/openDestination';
import { openHome } from '../../../shared/navigation/openHome';

type Params = Omit<ColumnActions, 'openConnections' | 'openHome'>;

const openConnections = (): void => openDestination({ id: 'connections' });

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
      openHome,
      openBoard,
      openInbox,
      openChat,
      openWorkflows,
      openNewChat,
      openConnections,
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
