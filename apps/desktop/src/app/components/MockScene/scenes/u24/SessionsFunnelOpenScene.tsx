import { SessionsFilterColumn, type SessionsFilterConfig } from './SessionsFilterColumn';

const CONFIG: SessionsFilterConfig = {
  statusFilter: ['attention', 'running'],
  isPopoverOpen: true,
  hasOpenSession: true,
};

export const SessionsFunnelOpenScene = () => <SessionsFilterColumn config={CONFIG} />;
