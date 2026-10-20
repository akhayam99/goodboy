import { useContext, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { RailRow } from '../../../features/workTreeModel/railGeometry';
import type { SpawnedFold } from './runSpawnedRowsOf';
import { SpawnedRailCell } from './SpawnedRailCell';
import { SpawnedTreeContext } from './spawnedTreeContext';

type SetParams = {
  readonly id: string;
  readonly isExpanded: boolean;
};

type Props = {
  readonly fold: SpawnedFold;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly onSet: (params: SetParams) => void;
};

export const SpawnedFoldRow = ({ fold, rail, railWidth, onSet }: Props) => {
  const { activeId, setActiveId } = useContext(SpawnedTreeContext);
  const Chevron = fold.isExpanded ? ChevronUp : ChevronDown;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowRight' && !fold.isExpanded) {
      event.preventDefault();
      event.stopPropagation();
      onSet({ id: fold.expandId, isExpanded: true });
      return;
    }
    if (event.key === 'ArrowLeft' && fold.isExpanded) {
      event.preventDefault();
      event.stopPropagation();
      onSet({ id: fold.expandId, isExpanded: false });
    }
  };
  return (
    <div
      role="treeitem"
      data-tree-id={fold.id}
      data-spawned-fold=""
      aria-level={fold.level}
      aria-expanded={fold.isExpanded}
      aria-selected={false}
      aria-label={fold.label}
      tabIndex={activeId === fold.id ? 0 : -1}
      onFocus={() => setActiveId(fold.id)}
      onKeyDown={onKeyDown}
      onClick={() => onSet({ id: fold.expandId, isExpanded: !fold.isExpanded })}
      className={cn(
        'flex h-7 min-w-0 items-center gap-2 rounded-md pr-2 text-ui text-muted-foreground',
        ROW_INTERACTIVE,
      )}
    >
      <SpawnedRailCell
        rail={rail}
        width={railWidth}
        marker={
          <span className="flex size-4 items-center justify-center rounded-full bg-background">
            <Chevron size={ICON_SIZE.row} aria-hidden />
          </span>
        }
      />
      <span className="min-w-0 flex-1 truncate">{fold.label}</span>
    </div>
  );
};
