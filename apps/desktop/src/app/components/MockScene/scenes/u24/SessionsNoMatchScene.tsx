import { SessionsFilterColumn, type SessionsFilterConfig } from './SessionsFilterColumn';

const CONFIG: SessionsFilterConfig = {
  statusFilter: ['done'],
  isPopoverOpen: false,
  hasOpenSession: false,
};

export const SessionsNoMatchScene = () => <SessionsFilterColumn config={CONFIG} />;
