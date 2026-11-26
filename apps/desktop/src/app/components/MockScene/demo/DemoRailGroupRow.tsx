import { useRef, type ReactNode } from 'react';
import { Lock } from '@goodboy/ui/icons';
import {
  ActivityMeta,
  ActivityRow,
  FOCUS_RING,
  ICON_SIZE,
  ROW_INTERACTIVE,
  Tooltip,
  WorkNode,
  cn,
  type WorkNodeMark,
} from '@goodboy/ui';
import type { RailRow } from '../../../../features/workTreeModel/railGeometry';
import { SpawnedRailCell } from './SpawnedRailCell';
import type { GroupAccess } from './hints/groupAccessOf';
import type { HintTally } from './hints/hintTally';
import { GROUP_ROW_HEIGHT } from './demoRailOf';
import { unlockHintOf } from './unlockHintOf';
import { useUpNextBreath } from './useUpNextBreath';

type Props = {
  readonly title: string;
  readonly previousTitle: string | undefined;
  readonly mark: WorkNodeMark;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly access: GroupAccess;
  readonly isActive: boolean;
  readonly isUpNext: boolean;
  readonly canReplay: boolean;
  readonly tally?: HintTally;
  readonly isTooltipSuppressed: boolean;
  readonly onSelect: () => void;
  readonly onIntent: () => void;
};

const REPLAY_HINT = 'Replay this chapter';

type NodeStateParams = {
  readonly access: GroupAccess;
};

const nodeStateOf = ({ access }: NodeStateParams) => {
  if (access === 'done') {
    return 'done';
  }
  return access === 'locked' ? 'queued' : 'marker';
};

type OrdinalParams = {
  readonly mark: WorkNodeMark;
};

const ordinalOf = ({ mark }: OrdinalParams): ReactNode => {
  if (mark.kind === 'index') {
    return mark.value;
  }
  return mark.kind === 'glyph' ? mark.glyph : null;
};

type StateParams = {
  readonly isUpNext: boolean;
  readonly isLocked: boolean;
  readonly unlockHint: string | undefined;
  readonly tally: HintTally | undefined;
};

const stateOf = ({ isUpNext, isLocked, unlockHint, tally }: StateParams): ReactNode => {
  if (isUpNext) {
    return <span className="text-primary">Up next</span>;
  }
  if (isLocked) {
    return (
      <span className="text-faint-foreground">
        <Lock size={ICON_SIZE.row} aria-hidden />
        <span className="sr-only">{unlockHint ?? 'Locked'}</span>
      </span>
    );
  }
  if (tally === undefined || tally.total === 0) {
    return null;
  }
  return (
    <span className="tabular-nums text-faint-foreground">
      {tally.tried} of {tally.total}
    </span>
  );
};

export const DemoRailGroupRow = ({
  title,
  previousTitle,
  mark,
  rail,
  railWidth,
  access,
  isActive,
  isUpNext,
  canReplay,
  tally,
  isTooltipSuppressed,
  onSelect,
  onIntent,
}: Props) => {
  const rowRef = useRef<HTMLButtonElement>(null);
  const isPulsing = useUpNextBreath({ targetRef: rowRef, isReady: isUpNext });
  const isLocked = access === 'locked';
  const unlockHint =
    isLocked && previousTitle !== undefined ? unlockHintOf({ previousTitle }) : undefined;
  const hint = canReplay && access === 'done' ? REPLAY_HINT : unlockHint;
  const marker = (
    <WorkNode
      look="quiet"
      state={nodeStateOf({ access })}
      tone={isActive ? 'primary' : 'neutral'}
      label={`${title}, ${access}`}
      mark={{ kind: 'dot' }}
    />
  );
  const row = (
    <button
      ref={rowRef}
      type="button"
      aria-disabled={isLocked ? true : undefined}
      title={isLocked ? undefined : title}
      onClick={isLocked ? undefined : onSelect}
      onPointerEnter={isLocked ? undefined : onIntent}
      onPointerDown={isLocked ? undefined : onIntent}
      onFocus={isLocked ? undefined : onIntent}
      aria-current={isActive ? 'page' : undefined}
      data-selected={isActive ? 'true' : 'false'}
      data-access={access}
      data-up-next={isUpNext ? 'ready' : 'none'}
      data-pulsing={isPulsing ? 'true' : 'false'}
      style={{ height: GROUP_ROW_HEIGHT }}
      className={cn(
        'flex w-full min-w-0 items-center rounded-md text-left',
        isLocked ? cn('cursor-default', FOCUS_RING) : ROW_INTERACTIVE,
        'data-[selected=true]:bg-selected data-[selected=true]:hover:bg-selected',
        'data-[up-next=ready]:bg-selected data-[up-next=ready]:ring-2 data-[up-next=ready]:ring-primary',
      )}
    >
      <SpawnedRailCell rail={rail} width={railWidth} marker={marker} />
      <ActivityRow
        density="feed"
        tone={isLocked ? 'pending' : 'quiet'}
        ordinal={ordinalOf({ mark })}
        text={title}
        meta={
          <ActivityMeta
            density="rail"
            columns={['state']}
            state={stateOf({ isUpNext, isLocked, unlockHint, tally })}
          />
        }
      />
    </button>
  );
  return (
    <Tooltip
      content={hint}
      side="right"
      anchorClassName="flex w-full"
      isSuppressed={isTooltipSuppressed}
    >
      {row}
    </Tooltip>
  );
};
