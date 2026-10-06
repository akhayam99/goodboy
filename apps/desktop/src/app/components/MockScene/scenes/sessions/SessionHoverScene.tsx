import { SessionColumnScene } from './SessionColumnScene';
import { hoverWebhookRow } from './columnScripts';

export const SessionHoverScene = () => (
  <SessionColumnScene isArchivedShown={false} run={hoverWebhookRow} />
);
