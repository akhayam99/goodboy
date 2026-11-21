import { Skeleton } from './Skeleton';

type Props = {
  readonly label: string;
};

export const StatCardsSkeleton = ({ label }: Props) => (
  <div
    role="status"
    aria-label={label}
    aria-busy="true"
    className="grid grid-cols-2 gap-4 lg:grid-cols-4"
  >
    {Array.from({ length: 4 }).map((_, index) => (
      <Skeleton key={index} className="h-20" />
    ))}
  </div>
);
