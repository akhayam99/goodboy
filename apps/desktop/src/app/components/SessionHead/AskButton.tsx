import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectIsAskOpen } from '../../../store/slices/ask/selectIsAskOpen';
import { selectDetailDrawer } from '../../../store/slices/drawer/selectDetailDrawer';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { PRESSED_TOGGLE } from '../../../shared/components/pressedToggle';

type Props = {
  readonly sessionId: SessionId;
};

export const AskButton = ({ sessionId }: Props) => {
  const AskIcon = CONCEPT_ICONS.ask;
  const isOpen = useAppStore((state) => selectIsAskOpen({ state, sessionId }));
  const toggle = () => {
    const state = useAppStore.getState();
    const detail = selectDetailDrawer({ state });
    if (isOpen && detail !== null) {
      state.closeDrawerEntry({ entry: detail });
      return;
    }
    state.openAsk({ sessionId });
  };
  return (
    <Tooltip content="Ask about this session" shortcut="ask.open">
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={isOpen}
        data-session-action="ask"
        className={PRESSED_TOGGLE}
        onClick={toggle}
      >
        <AskIcon size={ICON_SIZE.control} aria-hidden className="shrink-0" />
        Ask
      </Button>
    </Tooltip>
  );
};
