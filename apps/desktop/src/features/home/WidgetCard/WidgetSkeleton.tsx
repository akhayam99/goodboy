import { Skeleton } from '@goodboy/ui';

type Props = {
  readonly label: string;
};

export const WidgetSkeleton = ({ label }: Props) => (
  <div role="status" aria-label={label} className="flex min-w-0 flex-1 flex-col gap-3">
    <Skeleton className="h-3 w-2/3" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);
