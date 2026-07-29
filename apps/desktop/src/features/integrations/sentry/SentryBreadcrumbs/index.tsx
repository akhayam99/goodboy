import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import type { SentryBreadcrumb } from '../client';

type Props = {
  readonly breadcrumbs: ReadonlyArray<SentryBreadcrumb>;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const SentryBreadcrumbs = ({ breadcrumbs, isLoading, error }: Props) => {
  if (isLoading || error != null || breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {breadcrumbs.map((breadcrumb, index) => {
        const relativeDate =
          breadcrumb.timestamp == null ? '' : formatRelativeDuration(breadcrumb.timestamp);
        return (
          <div
            key={`${breadcrumb.timestamp ?? 'breadcrumb'}-${index}`}
            className="flex flex-col gap-1 rounded-md bg-muted/30 p-2"
          >
            <div className="flex items-center gap-2 text-2xs text-muted-foreground">
              <span className="font-medium text-foreground">{breadcrumb.category ?? 'event'}</span>
              {breadcrumb.level != null ? <span>{breadcrumb.level}</span> : null}
              {relativeDate !== '' ? <span>{relativeDate} ago</span> : null}
            </div>
            {breadcrumb.message != null ? (
              <span className="text-xs text-muted-foreground">{breadcrumb.message}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
