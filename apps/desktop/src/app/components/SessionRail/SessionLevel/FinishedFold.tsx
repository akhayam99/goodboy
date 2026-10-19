import { useId, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Reveal, SelectableRow, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { RailTreeNode, RailTreeOpen } from './useRailTreeOpen';

type Props = {
  readonly node: RailTreeNode;
  readonly tree: RailTreeOpen;
  readonly count: number;
  readonly isForcedOpen: boolean;
  readonly children: ReactNode;
};

export const FinishedFold = ({ node, tree, count, isForcedOpen, children }: Props) => {
  const bodyId = useId();
  const isOpen = isForcedOpen || tree.isOpen(node);
  return (
    <div data-finished-fold="" className="flex min-w-0 flex-col">
      <SelectableRow
        selected={false}
        isExpanded={isOpen}
        ariaLabel={`${count} finished`}
        onClick={() => tree.toggle(node)}
        className="h-7 items-center gap-2 pl-1 pr-1 text-ui"
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0 text-faint-foreground motion-safe:transition-transform',
            isOpen && 'rotate-90',
          )}
        />
        <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">
          {count} finished
        </span>
      </SelectableRow>
      <Reveal open={isOpen} id={bodyId}>
        <ul aria-label="Finished branches" className="flex flex-col">
          {children}
        </ul>
      </Reveal>
    </div>
  );
};
