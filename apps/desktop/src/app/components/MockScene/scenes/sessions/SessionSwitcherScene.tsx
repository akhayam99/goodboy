import { SessionColumnScene } from './SessionColumnScene';
import { holdControlTab } from './columnScripts';

export const SessionSwitcherScene = () => (
  <SessionColumnScene isArchivedShown={false} run={holdControlTab} />
);
