import { useRef } from 'react';
import { Lock } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, WorkNode, cn, type WorkNodeMark } from '@goodboy/ui';
import type { RailRow } from '../../../../features/workTreeModel/railGeometry';
import { SpawnedRailCell } from '../../SpawnedPanel/SpawnedRailCell';
import type { GroupAccess } from './hints/groupAccessOf';
import type { HintTally } from './hints/hintTally';
import { GROUP_ROW_HEIGHT } from './demoRailOf';
import { useUpNextBreath } from './useUpNextBreath';

type Props = {
  readonly title: string;
  readonly mark: WorkNodeMark;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly access: GroupAccess;
  readonly isActive: boolean;
  readonly isUpNext: boolean;
  readonly tally?: HintTally;
  readonly onSelect: () => void;
  readonly onIntent: () => void;
};

type NodeStateParams = {
  readonly access: GroupAccess;
};

const nodeStateOf = ({ access }: NodeStateParams) => {
  if (access === 'done') {
    return 'done';
  }
  return access === 'locked' ? 'queued' : 'marker';
};

export const DemoRailGroupRow = ({
  title,
  mark,
  rail,
  railWidth,
  access,
  isActive,
  isUpNext,
  tally,
  onSelect,
  onIntent,
}: Props) => {
  const rowRef = useRef<HTMLButtonElement>(null);
  const isPulsing = useUpNextBreath({ targetRef: rowRef, isReady: isUpNext });
  const isLocked = access === 'locked';
  const marker = (
    <WorkNode
      state={nodeStateOf({ access })}
      tone={isActive ? 'primary' : 'neutral'}
      label={`${title}, ${access}`}
      mark={mark}
    />
  );
  return (
    <button
      ref={rowRef}
      type="button"
      disabled={isLocked}
      onClick={onSelect}
      onPointerEnter={onIntent}
      onPointerDown={onIntent}
      onFocus={onIntent}
      aria-current={isActive ? 'page' : undefined}
      data-selected={isActive ? 'true' : 'false'}
      data-access={access}
      data-up-next={isUpNext ? 'ready' : 'none'}
      data-pulsing={isPulsing ? 'true' : 'false'}
      style={{ height: GROUP_ROW_HEIGHT }}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-md pr-2 text-left text-ui',
        isLocked ? 'cursor-default' : ROW_INTERACTIVE,
        'data-[selected=true]:bg-selected data-[selected=true]:hover:bg-selected',
        'data-[up-next=ready]:bg-selected data-[up-next=ready]:ring-2 data-[up-next=ready]:ring-primary',
      )}
    >
      <SpawnedRailCell rail={rail} width={railWidth} marker={marker} />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          className={cn(
            'truncate',
            isLocked
              ? 'text-faint-foreground'
              : isActive
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {title}
        </span>
      </span>
      {isUpNext ? <span className="shrink-0 text-meta text-primary">Up next</span> : null}
      {isLocked ? (
        <span className="shrink-0 text-faint-foreground">
          <Lock size={ICON_SIZE.row} aria-hidden />
          <span className="sr-only">Locked until the group before it is done</span>
        </span>
      ) : null}
      {tally !== undefined && tally.total > 0 && !isUpNext && !isLocked ? (
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
          {tally.tried} of {tally.total}
        </span>
      ) : null}
    </button>
  );
};
