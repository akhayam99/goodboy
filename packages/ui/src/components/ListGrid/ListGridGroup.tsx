import { useId, type ReactNode } from 'react';
import { TEXT_ROLE } from '../../textRoles';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';

export type ListGridGroupProps = {
  readonly label?: string;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly isListbox?: boolean;
  readonly activeDescendant?: string;
  readonly isSticky?: boolean;
  readonly lead?: ReactNode;
  readonly foot?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly children: ReactNode;
};

const HEADING_TAG = { 2: 'h2', 3: 'h3' } as const;

const SUBGRID = 'col-span-full grid grid-cols-subgrid';

export const ListGridGroup = ({
  label,
  count,
  action,
  isListbox = false,
  activeDescendant,
  isSticky = false,
  lead,
  foot,
  headingLevel = 3,
  children,
}: ListGridGroupProps) => {
  const headingId = useId();
  const Heading = HEADING_TAG[headingLevel];
  return (
    <li className={SUBGRID}>
      {label === undefined ? null : (
        <div
          data-list-grid-group-label=""
          className={cn(SUBGRID, 'h-7 items-center', isSticky && 'sticky top-0 z-10 bg-background')}
        >
          <div className="col-start-2 col-end-[-1] flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Heading
                id={headingId}
                className={cn('min-w-0 truncate text-row', TEXT_ROLE.secondary)}
              >
                {label}
              </Heading>
              {count === undefined ? null : (
                <span
                  data-list-grid-count=""
                  className={cn('shrink-0 text-row tabular-nums', TEXT_ROLE.hint)}
                >
                  {count}
                </span>
              )}
            </div>
            {action === undefined || action === null ? null : (
              <span className={cn('flex shrink-0 items-center gap-2 tabular-nums', TEXT_ROLE.hint)}>
                {action}
              </span>
            )}
          </div>
        </div>
      )}
      {lead === undefined || lead === null ? null : <ul className={SUBGRID}>{lead}</ul>}
      <ul
        role={isListbox ? 'listbox' : undefined}
        aria-labelledby={label === undefined ? undefined : headingId}
        aria-activedescendant={isListbox ? activeDescendant : undefined}
        tabIndex={isListbox && activeDescendant !== undefined ? 0 : undefined}
        className={cn(SUBGRID, isListbox && cn('rounded-md', FOCUS_RING))}
      >
        {children}
      </ul>
      {foot === undefined || foot === null ? null : <ul className={SUBGRID}>{foot}</ul>}
    </li>
  );
};
