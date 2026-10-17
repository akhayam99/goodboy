import type { ReactNode } from 'react';
import { cn } from '../../cn';
import type { FramePage } from '../../frameGeometry';
import { PANE_RHYTHM } from '../../paneRhythm';
import { PageColumn } from '../PageColumn';
import { Skeleton } from '../Skeleton';
import { PageHeader } from './PageHeader';
import { pageWidthOf } from './pageWidthOf';

type Props = {
  readonly page?: FramePage;
  readonly label: string;
  readonly hasTitle?: boolean;
  readonly children: ReactNode;
};

export const PageSkeleton = ({ page, label, hasTitle = true, children }: Props) => (
  <div
    role="status"
    aria-label={label}
    data-page-skeleton={page ?? ''}
    className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
  >
    <PageColumn
      width={pageWidthOf({ page, width: undefined })}
      className={cn('flex flex-col', !hasTitle && PANE_RHYTHM.headerInset)}
    >
      {hasTitle ? (
        <PageHeader
          isOnColumn
          animationClassName=""
          row={
            <div data-slot="skeleton-title-row" className="flex h-8 min-w-0 items-center">
              <Skeleton className="h-4 w-40" />
            </div>
          }
          {...(page !== undefined && { page })}
        />
      ) : null}
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </PageColumn>
  </div>
);
