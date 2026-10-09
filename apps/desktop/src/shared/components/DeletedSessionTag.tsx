import { Chip } from '@goodboy/ui';

const DELETED_SESSION_HINT = 'This session was deleted. Its cost and shipped work still count.';

export const DeletedSessionTag = () => (
  <Chip tone="neutral" kind="state" label="Deleted" title={DELETED_SESSION_HINT} />
);
