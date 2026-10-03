import type { ReactNode } from 'react';
import { InlineConfirm, type ConfirmAltAction, type ConfirmRole } from '../InlineConfirm';
import { cn } from '../../cn';

const SHOWN_ITEMS = 3;

export type SelectionConfirmProps = {
  readonly role: ConfirmRole;
  readonly icon: ReactNode;
  readonly title: string;
  readonly goes?: string;
  readonly stays?: string;
  readonly items?: ReadonlyArray<string>;
  readonly description?: string;
  readonly confirmLabel: string;
  readonly altAction?: ConfirmAltAction;
  readonly note?: ReactNode;
  readonly children?: ReactNode;
  readonly isBusy?: boolean;
  readonly isConfirmDisabled?: boolean;
  readonly onConfirm: () => void | Promise<void>;
  readonly onCancel: () => void;
  readonly className?: string;
};

export const SelectionConfirm = ({
  goes,
  stays,
  items = [],
  children,
  className,
  ...rest
}: SelectionConfirmProps) => {
  const shown = items.slice(0, SHOWN_ITEMS);
  const more = items.length - shown.length;
  return (
    <InlineConfirm {...rest} className={cn('w-full max-w-sm bg-floating shadow-lg', className)}>
      {goes === undefined && stays === undefined ? null : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 text-muted-foreground">
          {goes === undefined ? null : (
            <>
              <dt className="text-eyebrow text-faint-foreground">Goes</dt>
              <dd>{goes}</dd>
            </>
          )}
          {stays === undefined ? null : (
            <>
              <dt className="text-eyebrow text-faint-foreground">Stays</dt>
              <dd>{stays}</dd>
            </>
          )}
        </dl>
      )}
      {shown.length === 0 ? null : (
        <ul className="flex min-w-0 flex-col gap-0.5 text-foreground">
          {shown.map((item, index) => (
            <li key={`${index}:${item}`} className="truncate">
              {item}
            </li>
          ))}
          {more > 0 ? <li className="text-faint-foreground">and {more} more</li> : null}
        </ul>
      )}
      {children}
    </InlineConfirm>
  );
};
