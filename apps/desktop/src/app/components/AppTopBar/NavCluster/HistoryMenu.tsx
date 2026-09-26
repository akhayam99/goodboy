import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { HistoryLabel } from './historyLabel';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type HistoryItem = HistoryLabel & {
  readonly index: number;
  readonly isCurrent: boolean;
};

type Props = {
  readonly items: ReadonlyArray<HistoryItem>;
  readonly onJump: (index: number) => void;
};

export const HistoryMenu = ({ items, onJump }: Props) => (
  <div className="flex min-w-0 flex-col gap-0.5 p-1">
    {items.map((item) => (
      <button
        key={item.index}
        type="button"
        role="menuitemradio"
        aria-checked={item.isCurrent}
        onClick={() => onJump(item.index)}
        className={cn(
          'flex h-7.5 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-label transition-colors',
          item.isCurrent
            ? 'bg-overlay-selected text-foreground'
            : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        )}
      >
        <span className="min-w-0 truncate">{item.label}</span>
        {item.context !== null ? (
          <span className="min-w-0 flex-1 truncate text-secondary text-faint-foreground">
            {item.context}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <span className="flex w-3.5 shrink-0 justify-center">
          {item.isCurrent ? <Check size={ICON_SIZE.control} aria-hidden /> : null}
        </span>
      </button>
    ))}
  </div>
);
