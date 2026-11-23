import { Button, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { replayShortcut } from '../../../../shared/keyboard/replayShortcut';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
};

export const OpenOnDeskButton = ({ sessionId }: Props) => {
  const isOnOverview = useAppStore(
    (state) => (state.sessionFace[sessionId] ?? 'overview') === 'overview',
  );
  if (!isOnOverview) {
    return null;
  }
  return (
    <Tooltip content={shortcutGlyphs('session.desk')}>
      <Button variant="secondary" size="xs" onClick={() => replayShortcut({ id: 'session.desk' })}>
        {NAMES.openOnDesk}
      </Button>
    </Tooltip>
  );
};
