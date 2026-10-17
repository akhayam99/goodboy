import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  PopoverBody,
  SearchField,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { filterPickerClusters } from '../../filterPickerClusters';
import { pickerRowCount } from '../../pickerRowCount';
import type { PickerCluster } from '../../terminalPickerClusters';
import { TERMINAL_PICKER_EVENTS } from '../../terminalPickerEvents';
import type { TerminalTarget } from '../../terminalTargets';
import { PickerClusterView } from './PickerClusterView';

type Props = {
  readonly clusters: ReadonlyArray<PickerCluster>;
  readonly onNew: () => void;
  readonly onOpenAt: (target: TerminalTarget) => void;
};

const PICKER_WIDTH_CLASS = 'w-[32.5rem]';
const PICKER_EXPECTED_WIDTH = 520;
const PICKER_EXPECTED_HEIGHT = 420;
const PICKER_MAX_WIDTH = 520;

export const NewTerminalMenu = ({ clusters, onNew, onOpenAt }: Props) => {
  const [query, setQuery] = useState('');
  const [isFilterFocused, setIsFilterFocused] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);
  const dropdown = useDropdown({
    side: 'right',
    width: PICKER_WIDTH_CLASS,
    expectedWidth: PICKER_EXPECTED_WIDTH,
    expectedHeight: PICKER_EXPECTED_HEIGHT,
    maxWidth: PICKER_MAX_WIDTH,
    openEvent: TERMINAL_PICKER_EVENTS.page,
  });
  const hasChoices = pickerRowCount({ clusters }) > 1;
  const shown = useMemo(() => filterPickerClusters({ clusters, query }), [clusters, query]);
  const activeKey = isFilterFocused ? (shown[0]?.rows[0]?.key ?? null) : null;

  useEffect(() => {
    if (!dropdown.open) {
      setQuery('');
      return;
    }
    filterRef.current?.focus();
  }, [dropdown.open]);

  const pick = (target: TerminalTarget): void => {
    dropdown.close();
    onOpenAt(target);
  };

  const handleFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = shown[0]?.rows[0];
      if (first !== undefined) {
        pick(first.target);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      dropdown.popupRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  };

  return (
    <div className="flex min-w-0 items-stretch">
      <Button
        variant="secondary"
        className="min-w-0 flex-1 justify-start rounded-r-none"
        onClick={onNew}
      >
        <Plus size={ICON_SIZE.control} aria-hidden />
        New terminal
      </Button>
      {hasChoices ? (
        <AnchoredPopover
          dropdown={dropdown}
          anchorClassName="flex shrink-0"
          role="menu"
          ariaLabel="New terminal in"
          className="gap-0 p-0"
          trigger={
            <Tooltip content="New terminal in" anchorClassName="flex h-full">
              <Button
                variant="secondary"
                aria-label="New terminal in"
                aria-haspopup="menu"
                aria-expanded={dropdown.open}
                className="h-full rounded-l-none border-l-0 px-2"
                onClick={dropdown.toggle}
              >
                <ChevronDown size={ICON_SIZE.control} aria-hidden />
              </Button>
            </Tooltip>
          }
        >
          <PopoverBody className="max-h-full">
            <div className="flex flex-col gap-3 p-2">
              <SearchField
                ariaLabel="Filter terminal locations"
                placeholder="Type to filter"
                value={query}
                onChange={setQuery}
                inputRef={filterRef}
                onKeyDown={handleFilterKeyDown}
                onFocus={() => setIsFilterFocused(true)}
                onBlur={() => setIsFilterFocused(false)}
              />
              {shown.map((cluster) => (
                <PickerClusterView
                  key={cluster.key}
                  cluster={cluster}
                  activeKey={activeKey}
                  onPick={pick}
                />
              ))}
            </div>
          </PopoverBody>
        </AnchoredPopover>
      ) : null}
    </div>
  );
};
