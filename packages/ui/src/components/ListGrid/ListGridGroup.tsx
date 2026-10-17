import { useId, type ReactNode } from 'react';
import { TEXT_ROLE } from '../../textRoles';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';

export type ListGridGroupFold = {
  readonly label: string;
  readonly onToggle: () => void;
};

export type ListGridGroupProps = {
  readonly label?: string;
  readonly mark?: ReactNode;
  readonly count?: number;
  readonly fold?: ListGridGroupFold;
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

const COUNT_FLOOR = 2;

export const ListGridGroup = ({
  label,
  mark,
  count,
  fold,
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
          {mark === undefined || mark === null ? null : (
            <span
              data-list-grid-group-mark=""
              className="col-start-1 flex items-center justify-center"
            >
              {mark}
            </span>
          )}
          <div className="col-start-2 col-end-[-1] flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Heading
                id={headingId}
                className={cn('min-w-0 truncate text-row', TEXT_ROLE.secondary)}
              >
                {label}
              </Heading>
              {count === undefined || count < COUNT_FLOOR ? null : (
                <span
                  data-list-grid-count=""
                  className={cn('shrink-0 text-row tabular-nums', TEXT_ROLE.hint)}
                >
                  {count}
                </span>
              )}
              {fold === undefined ? null : (
                <button
                  type="button"
                  data-list-grid-fold=""
                  onClick={fold.onToggle}
                  className={cn(
                    'shrink-0 rounded-sm text-row hover:text-foreground',
                    TEXT_ROLE.hint,
                    FOCUS_RING,
                  )}
                >
                  {fold.label}
                </button>
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
