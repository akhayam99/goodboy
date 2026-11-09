import { X } from 'lucide-react';
import { IconButton, SelectableRow } from '@goodboy/ui';
import { BrowserFavicon } from './BrowserFavicon';

type Props = {
  readonly label: string;
  readonly url: string;
  readonly isSelected: boolean;
  readonly isPin: boolean;
  readonly onSelect: () => void;
  readonly onClose?: () => void;
};

export const BrowserTabRow = ({ label, url, isSelected, isPin, onSelect, onClose }: Props) => (
  <div className="flex min-w-0 items-center gap-1">
    <SelectableRow
      selected={isSelected}
      ariaCurrent={isSelected ? 'page' : undefined}
      ariaLabel={isPin ? `${label}, pinned` : label}
      onClick={onSelect}
      className="h-7 min-w-0 flex-1 items-center gap-2 px-2"
    >
      <BrowserFavicon url={url} isPin={isPin} />
      <span className="min-w-0 truncate text-row">{label}</span>
    </SelectableRow>
    {onClose === undefined ? null : (
      <IconButton icon={X} label={`Close ${label}`} size="xs" variant="ghost" onClick={onClose} />
    )}
  </div>
);
