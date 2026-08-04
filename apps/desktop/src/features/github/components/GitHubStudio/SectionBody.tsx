import type { ReactNode } from 'react';
import type { PrDetail } from '@goodboy/types';
import { Skeleton } from '@goodboy/ui';
import { AlertCircle, RefreshCw } from 'lucide-react';

type Props = {
  readonly detail: PrDetail | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
  readonly onRetry: () => void;
  readonly children: ReactNode;
};

export const SectionBody = ({ detail, detailLoading, detailError, onRetry, children }: Props) => {
  return (
    <div className="flex w-full flex-col gap-3">
      {detailError != null ? (
        <div className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle size={13} aria-hidden />
          <span className="min-w-0 flex-1 truncate" title={detailError}>
            {detailError}
          </span>
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry"
            className="rounded-md p-0.5 hover:bg-muted"
          >
            <RefreshCw size={12} aria-hidden />
          </button>
        </div>
      ) : detailLoading && detail == null ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading pr data">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  );
};
