import { AnchoredPopover, Button, MENU_MAX_WIDTH, MenuList, cn, useDropdown } from '@goodboy/ui';
import type { MenuEntry } from '@goodboy/ui';
import type { AskThread, ChatId } from '@goodboy/types';
import { useNow } from '../../../../../shared/hooks/useNow';
import { dayLabelOf } from '../../../../../shared/utils/time/dayLabelOf';

type Props = {
  readonly threads: ReadonlyArray<AskThread>;
  readonly isDisabled: boolean;
  readonly onShow: (threadId: ChatId) => void;
};

const EARLIER_CAP = 5;

const DAY_TICK_MS = 60_000;

const LABEL = 'Earlier questions';

export const AskEarlierMenu = ({ threads, isDisabled, onShow }: Props) => {
  const now = useNow(DAY_TICK_MS);
  const dropdown = useDropdown({
    disabled: isDisabled,
    width: 'min-w-60',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 220,
  });
  if (threads.length === 0) {
    return null;
  }
  const entries: ReadonlyArray<MenuEntry> = threads.slice(0, EARLIER_CAP).map((thread) => ({
    kind: 'item',
    key: thread.id,
    label: thread.title,
    hint: dayLabelOf({ at: thread.lastActivityAt, now }),
    onSelect: () => onShow(thread.id),
  }));
  return (
    <AnchoredPopover
      dropdown={dropdown}
      trigger={
        <Button
          variant="quiet"
          size="sm"
          aria-label={LABEL}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          disabled={isDisabled}
          onClick={dropdown.toggle}
          className={cn(dropdown.open && 'bg-selected')}
        >
          Earlier
        </Button>
      }
    >
      <MenuList label={LABEL} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
