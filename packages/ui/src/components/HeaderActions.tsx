import type { ReactElement, ReactNode } from 'react';
import { cn } from '../cn';

type Props = {
  readonly secondary?: ReactNode;
  readonly button?: ReactNode;
  readonly primary?: ReactElement | null;
  readonly overflow?: ReactNode;
  readonly className?: string;
  readonly slotClassNames?: Partial<Record<SlotName, string>>;
};

type SlotName = 'secondary' | 'button' | 'primary' | 'overflow';

type SlotParams = {
  readonly name: SlotName;
  readonly node: ReactNode;
  readonly className: string | undefined;
};

const isDrawn = (node: ReactNode): boolean =>
  node !== null && node !== undefined && node !== false && node !== '';

const slotOf = ({ name, node, className }: SlotParams): ReactNode =>
  isDrawn(node) ? (
    <div
      key={name}
      data-slot={`header-actions-${name}`}
      className={cn('flex h-7 min-w-0 shrink-0 items-center gap-2 empty:hidden', className)}
    >
      {node}
    </div>
  ) : null;

export const HeaderActions = ({
  secondary,
  button,
  primary,
  overflow,
  className,
  slotClassNames = {},
}: Props) => {
  if (![secondary, button, primary, overflow].some(isDrawn)) {
    return null;
  }
  return (
    <div
      data-slot="header-actions"
      className={cn(
        'hidden h-7 min-w-0 shrink-0 items-center justify-end gap-2 has-[>:not(:empty)]:flex',
        className,
      )}
    >
      {slotOf({ name: 'secondary', node: secondary, className: slotClassNames.secondary })}
      {slotOf({ name: 'button', node: button, className: slotClassNames.button })}
      {slotOf({ name: 'primary', node: primary, className: slotClassNames.primary })}
      {slotOf({ name: 'overflow', node: overflow, className: slotClassNames.overflow })}
    </div>
  );
};
