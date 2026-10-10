import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Skeleton, Tooltip, cn } from '@goodboy/ui';
import type { MountProjectGroup } from '../../../../../store/slices/project-mounts/mountRowModel';
import { ICON_SIZE, projectGlyph } from '../../../../../shared/components/conceptIcons';
import { MOUNT_ROW_HEIGHT, MOUNT_ROW_PAD } from './mountGrid';
import { projectSummaryOf } from './projectSummary';

type Props = {
  readonly group: MountProjectGroup;
  readonly openCount: number;
  readonly finishedCount: number;
  readonly isDisclosure: boolean;
  readonly isExpanded: boolean;
  readonly isSkeleton: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
};

export const ProjectGroupHeader = ({
  group,
  openCount,
  finishedCount,
  isDisclosure,
  isExpanded,
  isSkeleton,
  onToggle,
  children,
}: Props) => {
  const GlyphIcon = projectGlyph({ kind: group.projectKind });
  const summary = projectSummaryOf({ openCount, finishedCount });
  const lead = (
    <>
      <GlyphIcon size={ICON_SIZE.control} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="truncate text-row text-foreground">{group.projectName}</span>
      {isSkeleton ? (
        <Skeleton className="h-3.5 w-28" />
      ) : (
        <span className="truncate text-meta text-muted-foreground">{summary}</span>
      )}
      {isDisclosure ? (
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground motion-safe:transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
      ) : null}
    </>
  );

  return (
    <div
      data-slot="mount-header"
      style={{
        height: MOUNT_ROW_HEIGHT,
        paddingLeft: MOUNT_ROW_PAD,
        paddingRight: MOUNT_ROW_PAD,
      }}
      className="col-span-full flex min-w-0 items-center gap-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isDisclosure ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={`${group.projectName} worktrees`}
            onClick={onToggle}
            className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {lead}
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-2">{lead}</div>
        )}
        {group.seriesName === null ? null : (
          <Tooltip content="Each part of this split is its own branch and pull request">
            <span className="truncate text-meta text-muted-foreground">{group.seriesName}</span>
          </Tooltip>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
};
