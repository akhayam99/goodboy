import { useContext, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ICON_SIZE, PANE_RHYTHM, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { SpawnedStateGroup } from './spawnedStateGroupsOf';
import { SpawnedTreeContext } from './spawnedTreeContext';

type SetParams = {
  readonly isOpen: boolean;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLDivElement>;
};

type Props = {
  readonly group: SpawnedStateGroup;
  readonly isFoldable: boolean;
  readonly isOpen: boolean;
  readonly onSet: (params: SetParams) => void;
};

export const SpawnedStateHead = ({ group, isFoldable, isOpen, onSet }: Props) => {
  const { activeId, setActiveId } = useContext(SpawnedTreeContext);
  const id = `state:${group.key}`;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  const onKey = ({ event }: KeyParams): void => {
    if (!isFoldable) {
      return;
    }
    const isOpening = event.key === 'ArrowRight' && !isOpen;
    const isClosing = event.key === 'ArrowLeft' && isOpen;
    if (!isOpening && !isClosing) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSet({ isOpen: isOpening });
  };
  return (
    <div
      role="treeitem"
      data-tree-id={id}
      data-spawned-state-head={group.key}
      aria-level={1}
      aria-expanded={isFoldable ? isOpen : undefined}
      aria-selected={false}
      aria-label={`${group.label}, ${group.rows.length}`}
      tabIndex={activeId === id ? 0 : -1}
      onFocus={() => setActiveId(id)}
      onKeyDown={(event) => onKey({ event })}
      onClick={isFoldable ? () => onSet({ isOpen: !isOpen }) : undefined}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md text-meta text-muted-foreground',
        PANE_RHYTHM.tree.stateHead,
        isFoldable && ROW_INTERACTIVE,
      )}
    >
      {isFoldable ? <Chevron size={ICON_SIZE.row} aria-hidden className="shrink-0" /> : null}
      <span>{group.label}</span>
      <span className="tabular-nums text-faint-foreground">{group.rows.length}</span>
    </div>
  );
};
