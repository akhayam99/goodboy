import { Pin, X } from 'lucide-react';
import { ICON_SIZE, IconButton, SelectableRow } from '@goodboy/ui';
import { toolTabClassName } from '../../../../shared/utils/toolTabClassName';
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
  <div data-browser-tab="" className={toolTabClassName({ isSelected })}>
    <SelectableRow
      selected={isSelected}
      ariaCurrent={isSelected ? 'page' : undefined}
      ariaLabel={isPin ? `${label}, pinned` : label}
      title={isPin ? `${label}, pinned to the project` : undefined}
      tooltipSide="top"
      onClick={onSelect}
      className="w-auto min-w-12 flex-1 items-center gap-2 self-stretch focus-visible:ring-0"
    >
      <BrowserFavicon url={url} isPin={isPin} />
      <span className="min-w-0 truncate">{label}</span>
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
