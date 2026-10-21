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
};

export const BranchRow = ({ sessionId, entry, isProjectShown }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const { fact, story } = entry;
  const target = useMountMenuTarget({ sessionId, mountId: fact.mountId });
  const menu = useObjectMenuTrigger({ target, anchorKey: `central-branch:${fact.mountId}` });
  const request = fact.request === null ? '' : `${fact.request.noun}${fact.request.number}`;
  const cells = [
    <Tooltip key="branch" content={fact.branch}>
      <span className="min-w-0 truncate text-code text-foreground">{fact.branch}</span>
    </Tooltip>,
    ...(isProjectShown ? [fact.projectName] : []),
    request,
    <StageTrack key="track" stages={story.steps} tone={story.tone} />,
    <span
      key="state"
      data-branch-state={story.state}
      className={cn('min-w-0 truncate', tintClasses(story.tone).text)}
    >
      {story.word}
    </span>,
    <OptionalTooltip key="detail" content={story.blocker}>
      <span className="min-w-0 truncate">{story.blocker}</span>
    </OptionalTooltip>,
    <ChevronRight key="open" size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />,
  ];
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
    />
  );
};
