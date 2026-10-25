import { ChevronRight } from 'lucide-react';
import {
  ICON_SIZE,
  ListGridRow,
  OptionalTooltip,
  StageTrack,
  Tooltip,
  cn,
  tintClasses,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { branchPlace, useAppStore } from '../../../../store';
import { useMountMenuTarget } from '../../hooks/useMountMenuTarget';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { branchSentenceOf, type BranchEntry } from './branchStoryOf';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: BranchEntry;
  readonly isProjectShown: boolean;
  readonly isNarrow?: boolean;
};

export const BranchRow = ({ sessionId, entry, isProjectShown, isNarrow = false }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const { fact, story } = entry;
  const target = useMountMenuTarget({ sessionId, mountId: fact.mountId });
  const menu = useObjectMenuTrigger({ target, anchorKey: `central-branch:${fact.mountId}` });
  const request = fact.request === null ? '' : `${fact.request.noun}${fact.request.number}`;
  const stateCell = (
    <span
      key="state"
      data-branch-state={story.state}
      className={cn('min-w-0 truncate', tintClasses(story.tone).text)}
    >
      {story.word}
    </span>
  );
  const branchLine = (
    <span className="flex min-w-0 items-baseline gap-2">
      {fact.series === null ? null : (
        <span data-branch-series="" className="shrink-0 text-ui text-faint-foreground">
          {`Part ${fact.series.position}${fact.series.total === null ? '' : ` of ${fact.series.total}`}`}
        </span>
      )}
      <span className="min-w-0 truncate text-code text-foreground">{fact.branch}</span>
    </span>
  );
  const openCell = (
    <ChevronRight key="open" size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
  );
  const narrowCells = [
    <Tooltip key="branch" content={fact.branch}>
      <span className="flex min-w-0 flex-col gap-0.5">
        {branchLine}
        <span className="flex min-w-0 items-baseline gap-2 text-ui">
          {request === '' ? null : (
            <span className="shrink-0 text-faint-foreground">{request}</span>
          )}
          {stateCell}
        </span>
      </span>
    </Tooltip>,
    openCell,
  ];
  const wideCells = [
    <Tooltip key="branch" content={fact.branch}>
      {branchLine}
    </Tooltip>,
    ...(isProjectShown ? [fact.projectName] : []),
    request,
    <StageTrack key="track" stages={story.steps} tone={story.tone} />,
    stateCell,
    <OptionalTooltip key="detail" content={story.blocker}>
      <span className="min-w-0 truncate">{story.blocker}</span>
    </OptionalTooltip>,
    openCell,
  ];
  const cells = isNarrow ? narrowCells : wideCells;
  return (
    <ListGridRow
      rowKey={fact.mountId}
      ariaLabel={branchSentenceOf({ fact, story })}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      onSelect={() =>
        navigate({ to: branchPlace({ sessionId, mountPath: fact.mountPath, tab: 'pr' }) })
      }
      cells={cells}
      rowHeight={isNarrow ? 'stack' : 32}
    />
  );
};
