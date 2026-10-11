import { SessionsFilterColumn, type SessionsFilterConfig } from './SessionsFilterColumn';

const CONFIG: SessionsFilterConfig = {
  statusFilter: ['review'],
  isPopoverOpen: false,
  hasOpenSession: true,
};

export const SessionsHiddenScene = () => <SessionsFilterColumn config={CONFIG} />;
