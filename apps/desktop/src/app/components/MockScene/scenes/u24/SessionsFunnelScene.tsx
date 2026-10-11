import { SessionsFilterColumn, type SessionsFilterConfig } from './SessionsFilterColumn';

const CONFIG: SessionsFilterConfig = {
  statusFilter: ['attention', 'running'],
  isPopoverOpen: false,
  hasOpenSession: true,
};

export const SessionsFunnelScene = () => <SessionsFilterColumn config={CONFIG} />;
