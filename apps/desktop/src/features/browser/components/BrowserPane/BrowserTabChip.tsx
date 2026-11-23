import { Pin, X } from '@goodboy/ui/icons';
import { ICON_SIZE, IconButton, OptionalTooltip } from '@goodboy/ui';
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
    <OptionalTooltip
      content={isPin ? `${label}, pinned to the project` : undefined}
      side="top"
      anchorClassName="flex min-w-0 flex-1 self-stretch"
    >
      <button
        type="button"
        aria-current={isSelected ? 'page' : undefined}
        aria-label={isPin ? `${label}, pinned` : label}
        onClick={onSelect}
        className="flex min-w-12 flex-1 items-center gap-2 self-stretch text-left focus-visible:outline-none"
      >
        <BrowserFavicon url={url} isPin={isPin} />
        <span className="min-w-0 truncate">{label}</span>
        {isPin ? (
          <Pin size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        ) : null}
      </button>
    </OptionalTooltip>
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
