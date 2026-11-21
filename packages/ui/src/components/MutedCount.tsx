import { cn } from '../cn';
import { TEXT_ROLE } from '../textRoles';

type Props = {
  readonly count: number;
  readonly className?: string;
};

export const MutedCount = ({ count, className }: Props) => {
  if (count <= 0) {
    return null;
  }
  return (
    <span data-muted-count="" className={cn('shrink-0 tabular-nums', TEXT_ROLE.hint, className)}>
      {count}
    </span>
  );
};
