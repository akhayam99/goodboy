import { ChevronDown, Plus } from 'lucide-react';
import { AnchoredPopover, Button, ICON_SIZE, Tooltip, useDropdown } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

import { useShortcut } from '../../../../../shared/keyboard/useShortcut';
import { NewFormMenuList } from '../../../../actions/NewFormMenuList';

type Props = {
  readonly session: Session;
};

export const OverviewActions = ({ session }: Props) => {
  const sessionId = session.id;
  const isStudioOpen = useAppStore((state) => state.appStudio !== null);
  const dropdown = useDropdown({ align: 'end', width: 'min-w-50', expectedHeight: 220 });

  useShortcut('overview.newHere', dropdown.toggle, !isStudioOpen);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      trigger={
        <Tooltip content="New" shortcut="overview.newHere" isSuppressed={dropdown.open}>
          <Button
            variant="secondary"
            size="sm"
            onClick={dropdown.toggle}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
          >
            <Plus size={ICON_SIZE.control} aria-hidden className="shrink-0" />
            New
            <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          </Button>
        </Tooltip>
      }
    >
      <NewFormMenuList facts={{ sessionId }} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
