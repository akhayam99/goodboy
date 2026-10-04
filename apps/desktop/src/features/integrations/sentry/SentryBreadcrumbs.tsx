import { formatSpan } from '../../../shared/utils/time/formatSpan';
import type { SentryBreadcrumb } from './client';
import { useNow } from '../../../shared/hooks/useNow';

type Props = {
  readonly breadcrumbs: ReadonlyArray<SentryBreadcrumb>;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const SentryBreadcrumbs = ({ breadcrumbs, isLoading, error }: Props) => {
  const now = useNow(30_000);
  if (isLoading || error != null || breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {breadcrumbs.map((breadcrumb, index) => {
        const relativeDate =
          breadcrumb.timestamp == null ? '' : formatSpan({ from: breadcrumb.timestamp, to: now });
        return (
          <div
            key={`${breadcrumb.timestamp ?? 'breadcrumb'}-${index}`}
            className="flex flex-col gap-1 rounded-md bg-subtle p-2"
          >
            <div className="flex items-center gap-2 text-meta text-muted-foreground">
              <span className="font-medium text-foreground">{breadcrumb.category ?? 'event'}</span>
              {breadcrumb.level != null ? <span>{breadcrumb.level}</span> : null}
              {relativeDate !== '' ? <span>{relativeDate} ago</span> : null}
            </div>
            {breadcrumb.message != null ? (
              <span className="text-label text-muted-foreground">{breadcrumb.message}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
