import type { ReactNode } from 'react';
import { InlineConfirm, type ConfirmAltAction, type ConfirmRole } from '../InlineConfirm';
import { cn } from '../../cn';
import { FLOATING_SURFACE } from '../../floatingSurface';
import { ConfirmGoesStays } from './ConfirmGoesStays';

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
    <InlineConfirm {...rest} className={cn(FLOATING_SURFACE, 'w-full max-w-sm', className)}>
      <ConfirmGoesStays goes={goes} stays={stays} />
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
