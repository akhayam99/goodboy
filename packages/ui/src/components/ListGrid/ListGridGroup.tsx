import { useId, type ReactNode } from 'react';
import { TEXT_ROLE } from '../../textRoles';
import { cn } from '../../cn';

export type ListGridGroupProps = {
  readonly label: string;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly children: ReactNode;
};

export const ListGridGroup = ({
  label,
  count,
  action,
  headingLevel = 3,
  children,
}: ListGridGroupProps) => {
  const headingId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <li className="col-span-full grid grid-cols-subgrid">
      <div className="col-span-full grid h-7 grid-cols-subgrid items-center">
        <Heading
          id={headingId}
          className={cn('col-start-2 col-end-[-3] min-w-0 truncate text-row', TEXT_ROLE.secondary)}
        >
          {label}
        </Heading>
        <span
          className={cn(
            'col-start-[-3] col-end-[-2] flex items-center justify-end gap-2 tabular-nums',
            TEXT_ROLE.hint,
          )}
        >
          {action}
          {count === undefined ? null : count}
        </span>
      </div>
      <ul aria-labelledby={headingId} className="col-span-full grid grid-cols-subgrid">
        {children}
      </ul>
    </li>
  );
};
