import { useMemo } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { AnchoredPopover, Button, ICON_SIZE, MENU_MAX_WIDTH, useDropdown } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { AppMenuList } from '../../../actions/AppMenuList';
import { consoleSendTargetsOf } from '../../consoleSendTargetsOf';

type SendParams = {
  readonly sessionId: SessionId;
};

type Props = {
  readonly sessionId: SessionId;
  readonly isDisabled: boolean;
  readonly onSend: (params: SendParams) => void;
};

export const BrowserConsoleSendMenu = ({ sessionId, isDisabled, onSend }: Props) => {
  const sessions = useAppStore((state) => state.sessions);
  const dropdown = useDropdown({
    width: 'min-w-[200px]',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 200,
    expectedWidth: 240,
  });
  const targets = useMemo(
    () => consoleSendTargetsOf({ sessions, sessionId }),
    [sessions, sessionId],
  );
  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="shrink-0"
      trigger={
        <Button
          variant="secondary"
          size="xs"
          disabled={isDisabled || targets.length === 0}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        >
          <Bot size={ICON_SIZE.row} aria-hidden />
          Send to session
          <ChevronDown size={ICON_SIZE.row} aria-hidden />
        </Button>
      }
    >
      <AppMenuList
        label="Send to session"
        onClose={dropdown.close}
        entries={targets.map((target) => ({
          kind: 'item' as const,
          key: target.sessionId,
          label: target.title,
          hint: target.isCurrent ? 'This session' : null,
          onSelect: () => onSend({ sessionId: target.sessionId }),
        }))}
      />
    </AnchoredPopover>
  );
};
