import { Button, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import { switchSessionFace } from '../../../session/components/SessionDesk/switchSessionFace';

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
      <Button
        variant="secondary"
        size="xs"
        onClick={() => switchSessionFace({ sessionId, face: 'desk' })}
      >
        {NAMES.openOnDesk}
      </Button>
    </Tooltip>
  );
};
