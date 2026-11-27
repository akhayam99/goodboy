import { Button, KeyHint } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { NAMES } from '../../../shared/utils/names';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionCloseButton = ({ sessionId }: Props) => {
  const closeSession = useAppStore((state) => state.closeSession);
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={NAMES.closeSession}
      data-session-close=""
      onClick={() => closeSession({ sessionId })}
    >
      {NAMES.close}
      <KeyHint keys={shortcutGlyphs('app.close')} />
    </Button>
  );
};
