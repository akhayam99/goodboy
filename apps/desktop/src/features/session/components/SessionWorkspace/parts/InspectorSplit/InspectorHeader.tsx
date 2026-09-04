import type { ReactNode } from 'react';
import { cn, Divider, Tooltip } from '@goodboy/ui';
import { X } from 'lucide-react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

type Props = {
  readonly title: string;
  readonly closeLabel?: string;
  readonly actions?: ReactNode;
  readonly onClose?: () => void;
};

export const InspectorHeader = ({ title, closeLabel = 'close panel', actions, onClose }: Props) => (
  <>
    <div
      className={cn('flex shrink-0 items-center justify-between gap-2', PANE_RHYTHM.rail.header)}
    >
      <span className="truncate text-xs font-medium text-foreground" title={title}>
        {title}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        {actions}
        {onClose !== undefined && (
          <Tooltip content={closeLabel}>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <X size={ICON_SIZE.control} aria-hidden />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
    <Divider />
  </>
);
