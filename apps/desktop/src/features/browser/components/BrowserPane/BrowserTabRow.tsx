import { Moon, X } from 'lucide-react';
import { ICON_SIZE, IconButton, SelectableRow, cn } from '@goodboy/ui';
import { BrowserFavicon } from './BrowserFavicon';

type Props = {
  readonly label: string;
  readonly url: string;
  readonly isSelected: boolean;
  readonly isPin: boolean;
  readonly isAsleep?: boolean;
  readonly isCompact?: boolean;
  readonly onSelect: () => void;
  readonly onClose?: () => void;
};

const ASLEEP_TITLE = 'Asleep, may reload when opened';

type TitleParams = {
  readonly label: string;
  readonly isAsleep: boolean;
  readonly isCompact: boolean;
};

const hoverOf = ({ label, isAsleep, isCompact }: TitleParams): string | undefined => {
  if (!isCompact) {
    return isAsleep ? ASLEEP_TITLE : undefined;
  }
  return isAsleep ? `${label}. ${ASLEEP_TITLE}` : label;
};

export const BrowserTabRow = ({
  label,
  url,
  isSelected,
  isPin,
  isAsleep = false,
  isCompact = false,
  onSelect,
  onClose,
}: Props) => {
  const named = isPin ? `${label}, pinned` : label;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <SelectableRow
        selected={isSelected}
        ariaCurrent={isSelected ? 'page' : undefined}
        ariaLabel={isAsleep ? `${named}, asleep` : named}
        title={hoverOf({ label, isAsleep, isCompact })}
        tooltipSide="right"
        onClick={onSelect}
        className={cn(
          'h-7 min-w-0 flex-1 items-center gap-2 px-2',
          isCompact && 'justify-center px-0',
        )}
      >
        <BrowserFavicon url={url} isPin={isPin} isAsleep={isAsleep} />
        {isCompact ? null : (
          <span
            className={cn('min-w-0 flex-1 truncate text-row', isAsleep && 'text-muted-foreground')}
          >
            {label}
          </span>
        )}
        {isCompact || !isAsleep ? null : (
          <Moon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        )}
      </SelectableRow>
      {onClose === undefined || isCompact ? null : (
        <IconButton icon={X} label={`Close ${label}`} size="xs" variant="ghost" onClick={onClose} />
      )}
    </div>
  );
};
