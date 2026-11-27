import { useMemo } from 'react';
import type { ColumnActions } from '../../components/ShellLeft/columnDoors';
import { openDestination } from '../../../shared/navigation/openDestination';

type Params = Omit<ColumnActions, 'openConnections' | 'openCalendar'>;

const openConnections = (): void => openDestination({ id: 'connections' });

const openCalendar = (): void => openDestination({ id: 'calendar' });

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
      openCalendar,
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
