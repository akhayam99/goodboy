import { Pin, X } from 'lucide-react';
import { ICON_SIZE, IconButton, SelectableRow, cn } from '@goodboy/ui';
import { BrowserFavicon } from './BrowserFavicon';

type Props = {
  readonly label: string;
  readonly url: string;
  readonly isSelected: boolean;
  readonly isPin: boolean;
  readonly onSelect: () => void;
  readonly onClose?: () => void;
};

export const BrowserTabChip = ({ label, url, isSelected, isPin, onSelect, onClose }: Props) => (
  <div
    data-browser-tab=""
    className={cn(
      'flex h-7 max-w-48 shrink-0 items-center rounded-md',
      isSelected && 'bg-selected',
    )}
  >
    <SelectableRow
      selected={isSelected}
      ariaCurrent={isSelected ? 'page' : undefined}
      ariaLabel={isPin ? `${label}, pinned` : label}
      title={isPin ? `${label}, pinned to the project` : undefined}
      tooltipSide="top"
      onClick={onSelect}
      className="h-7 w-auto min-w-0 items-center gap-2 px-2"
    >
      <BrowserFavicon url={url} isPin={isPin} />
      <span className="min-w-0 truncate text-ui">{label}</span>
      {isPin ? (
        <Pin size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
      ) : null}
    </SelectableRow>
    {onClose === undefined ? null : (
      <IconButton
        icon={X}
        label={`Close ${label}`}
        size="xs"
        variant="ghost"
        tooltipSide="top"
        onClick={onClose}
      />
    )}
  </div>
);
