import { SessionColumnScene } from './SessionColumnScene';
import { openSessionsPopover } from './columnScripts';

export const SessionsPopoverScene = () => (
  <SessionColumnScene isArchivedShown={false} run={openSessionsPopover} />
);
