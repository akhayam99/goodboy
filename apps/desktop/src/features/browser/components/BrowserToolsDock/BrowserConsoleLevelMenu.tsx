import { ChevronDown } from '@goodboy/ui/icons';
import { AnchoredPopover, Button, ICON_SIZE, MENU_MAX_WIDTH, useDropdown } from '@goodboy/ui';
import { AppMenuList } from '../../../actions/AppMenuList';
import type { ConsoleLevelFilter } from '../../consoleRowsOf';
import { levelSelectOf } from './levelSelectOf';

type Props = {
  readonly level: ConsoleLevelFilter;
  readonly onChange: (params: ChangeParams) => void;
};

type ChangeParams = {
  readonly next: ConsoleLevelFilter;
};

const LEVEL_LABELS = {
  all: 'All levels',
  error: 'Errors',
  warn: 'Warnings',
  info: 'Info and logs',
} as const satisfies Record<ConsoleLevelFilter, string>;

export const BrowserConsoleLevelMenu = ({ level, onChange }: Props) => {
  const dropdown = useDropdown({
    width: 'min-w-[200px]',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 160,
    expectedWidth: 200,
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="shrink-0"
      trigger={
        <Button
          variant="quiet"
          size="xs"
          aria-label="Filter by level"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        >
          {LEVEL_LABELS[level]}
          <ChevronDown size={ICON_SIZE.row} aria-hidden />
        </Button>
      }
    >
      <AppMenuList
        label="Filter by level"
        onClose={dropdown.close}
        entries={[
          {
            kind: 'radio',
            key: 'level',
            label: 'Level',
            onSelect: levelSelectOf({ onChange }),
            choices: [
              { id: 'all', label: LEVEL_LABELS.all, isCurrent: level === 'all' },
              { id: 'error', label: LEVEL_LABELS.error, isCurrent: level === 'error' },
              { id: 'warn', label: LEVEL_LABELS.warn, isCurrent: level === 'warn' },
              { id: 'info', label: LEVEL_LABELS.info, isCurrent: level === 'info' },
            ],
          },
        ]}
      />
    </AnchoredPopover>
  );
};
