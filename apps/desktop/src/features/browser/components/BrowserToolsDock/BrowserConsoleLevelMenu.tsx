import { ChevronDown } from '@goodboy/ui/icons';
import { AnchoredPopover, Button, ICON_SIZE, MENU_MAX_WIDTH, useDropdown } from '@goodboy/ui';
import { AppMenuList } from '../../../actions/AppMenuList';
import type { ConsoleLevelFilter } from '../../consoleRowsOf';
import type { BrowserConsoleKind } from '../../types';
import { levelSelectOf } from './levelSelectOf';

type Props = {
  readonly kind: BrowserConsoleKind;
  readonly level: ConsoleLevelFilter;
  readonly onChange: (params: ChangeParams) => void;
};

type ChangeParams = {
  readonly next: ConsoleLevelFilter;
};

type LabelParams = {
  readonly kind: BrowserConsoleKind;
  readonly level: ConsoleLevelFilter;
};

const CONSOLE_LABELS = {
  all: 'All levels',
  error: 'Errors',
  warn: 'Warnings',
  info: 'Info and logs',
} as const satisfies Record<ConsoleLevelFilter, string>;

const NETWORK_LABELS = {
  all: 'All requests',
  error: 'Failed',
  warn: 'Failed',
  info: 'Succeeded',
} as const satisfies Record<ConsoleLevelFilter, string>;

const levelLabelOf = ({ kind, level }: LabelParams): string =>
  kind === 'console' ? CONSOLE_LABELS[level] : NETWORK_LABELS[level];

export const BrowserConsoleLevelMenu = ({ kind, level, onChange }: Props) => {
  const dropdown = useDropdown({
    width: 'min-w-[200px]',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 160,
    expectedWidth: 200,
  });
  const labels = kind === 'console' ? CONSOLE_LABELS : NETWORK_LABELS;
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
          {levelLabelOf({ kind, level })}
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
              { id: 'all', label: labels.all, isCurrent: level === 'all' },
              { id: 'error', label: labels.error, isCurrent: level === 'error' },
              ...(kind === 'console'
                ? [{ id: 'warn', label: labels.warn, isCurrent: level === 'warn' }]
                : []),
              { id: 'info', label: labels.info, isCurrent: level === 'info' },
            ],
          },
        ]}
      />
    </AnchoredPopover>
  );
};
