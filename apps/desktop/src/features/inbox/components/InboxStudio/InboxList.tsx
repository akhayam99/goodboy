import type { ReactNode } from 'react';
import { Button, EmptyLine, EmptyState, ListGrid, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { TASK_COLUMNS } from './taskColumns';

type Props = {
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly connectedCount: number;
  readonly failureCount: number;
  readonly isLoading: boolean;
  readonly hasFiltersActive: boolean;
  readonly onOpenSettings: () => void;
  readonly onClearFilters: () => void;
  readonly children: ReactNode;
};

export const InboxList = ({
  totalCount,
  visibleCount,
  connectedCount,
  failureCount,
  isLoading,
  hasFiltersActive,
  onOpenSettings,
  onClearFilters,
  children,
}: Props) => {
  const isShowingSkeleton = isLoading && totalCount === 0;
  return (
    <div className="flex flex-col gap-4">
      {isShowingSkeleton ? (
        <div className="flex flex-col" role="status" aria-label="Loading tasks">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex h-8 items-center gap-3">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-20 shrink-0 rounded-sm" />
              <Skeleton className="h-3 flex-1 rounded-sm" />
            </div>
          ))}
        </div>
      ) : null}
      {!isShowingSkeleton && connectedCount === 0 && totalCount === 0 ? (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.inbox}
          title="No tool connected"
          description="Connect a tool to see what is assigned to you."
          action={
            <Button variant="primary" size="sm" onClick={onOpenSettings}>
              Connect a tool
            </Button>
          }
        />
      ) : null}
      {!isShowingSkeleton && connectedCount > 0 && totalCount === 0 && failureCount === 0 ? (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.inbox}
          title="No items yet"
          description="Issues and errors assigned to you in your tools arrive as items."
        />
      ) : null}
      {totalCount > 0 && visibleCount === 0 ? (
        <EmptyLine
          action={
            hasFiltersActive ? (
              <Button variant="ghost" size="xs" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        >
          No items match these filters.
        </EmptyLine>
      ) : null}
      <ListGrid label="Task items" columns={TASK_COLUMNS} isGrouped>
        {children}
      </ListGrid>
    </div>
  );
};
