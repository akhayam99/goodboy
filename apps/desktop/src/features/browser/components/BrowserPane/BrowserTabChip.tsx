import { X } from '@goodboy/ui/icons';
import { IconButton, SelectableRow, cn } from '@goodboy/ui';
import { BrowserFavicon } from './BrowserFavicon';

type Props = {
  readonly label: string;
  readonly url: string;
  readonly isPin: boolean;
  readonly isAsleep: boolean;
  readonly onSelect: () => void;
  readonly onClose?: () => void;
};

const ASLEEP_NOTE = 'Asleep, opens at its address and may reload';

type NameParams = {
  readonly label: string;
  readonly isPin: boolean;
  readonly isAsleep: boolean;
};

const nameOf = ({ label, isPin, isAsleep }: NameParams): string => {
  const named = isPin ? `${label}, pinned` : label;
  return isAsleep ? `${named}, asleep` : named;
};

const hoverOf = ({ label, isPin, isAsleep }: NameParams): string => {
  const named = isPin ? `${label}, pinned to the project` : label;
  return isAsleep ? `${named}. ${ASLEEP_NOTE}` : named;
};

export const BrowserTabChip = ({ label, url, isPin, isAsleep, onSelect, onClose }: Props) => (
  <div
    data-browser-tab={isPin ? 'pin' : 'tab'}
    className={cn(
      'group flex h-7 items-center overflow-hidden rounded-md text-ui text-muted-foreground',
      'hover:bg-hover hover:text-foreground motion-safe:transition-colors',
      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring',
      isPin ? 'w-8 shrink-0' : 'min-w-8 max-w-48 shrink basis-32',
    )}
  >
    <SelectableRow
      selected={false}
      ariaLabel={nameOf({ label, isPin, isAsleep })}
      title={hoverOf({ label, isPin, isAsleep })}
      tooltipSide="top"
      onClick={onSelect}
      className={cn(
        'h-full min-w-0 flex-1 items-center gap-2 text-inherit hover:bg-transparent hover:text-inherit focus-visible:ring-0',
        isPin ? 'justify-center' : 'pl-2',
      )}
    >
      <BrowserFavicon url={url} isPin={isPin} isAsleep={isAsleep} />
      {isPin ? null : <span className="min-w-0 truncate">{label}</span>}
    </SelectableRow>
    {onClose === undefined ? null : (
      <IconButton
        icon={X}
        label={`Close ${label}`}
        size="xs"
        variant="ghost"
        tooltipSide="top"
        onClick={onClose}
        className="hidden shrink-0 group-hover:flex group-focus-within:flex"
      />
    )}
  </div>
);
