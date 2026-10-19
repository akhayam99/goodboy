import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { FOCUS_RING, Reveal, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { CARD_INSET, CARD_ROW_INSET } from './railInset';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly meta?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const LevelCard = ({ id, label, isOpen, onToggle, meta, action, children }: Props) => {
  const bodyId = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      data-level-card={label}
      data-open={isOpen ? '' : undefined}
      className={cn('flex min-w-0 flex-col rounded-lg bg-subtle', CARD_INSET)}
    >
      <div className="flex h-7 min-w-0 items-center justify-between gap-2">
        <h2 id={id} className="flex h-full min-w-0">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={bodyId}
            onClick={onToggle}
            className={cn(
              'flex h-full min-w-0 items-center gap-1 rounded-md text-ui text-muted-foreground hover:text-foreground',
              CARD_ROW_INSET,
              FOCUS_RING,
            )}
          >
            <span className="truncate">{label}</span>
            <ChevronDown
              size={ICON_SIZE.row}
              aria-hidden
              className={cn(
                'shrink-0 text-faint-foreground motion-safe:transition-transform',
                !isOpen && '-rotate-90',
              )}
            />
          </button>
        </h2>
        <div data-card-actions="" className="flex shrink-0 items-center gap-2">
          {isOpen || meta === undefined ? null : meta}
          {action}
        </div>
      </div>
      <Reveal open={isOpen} id={bodyId}>
        <div className="flex min-w-0 flex-col">{children}</div>
      </Reveal>
    </div>
  );
};
