import type { ReactNode } from 'react';
import { CircleAlert } from '../icons';
import { cn } from '../cn';
import { fieldErrorAriaOf } from '../fieldErrorAriaOf';
import { ICON_SIZE } from '../iconSize';

export type FieldErrorProps = {
  readonly id: string;
  readonly error: ReactNode;
  readonly className?: string;
};

export const FieldError = ({ id, error, className }: FieldErrorProps) => {
  if (fieldErrorAriaOf({ id, error })['aria-invalid'] !== true) {
    return null;
  }
  return (
    <p
      id={id}
      role="alert"
      data-slot="field-error"
      className={cn('flex items-start gap-2 text-meta text-foreground', className)}
    >
      <span className="flex h-4 shrink-0 items-center">
        <CircleAlert size={ICON_SIZE.control} aria-hidden className="text-danger" />
      </span>
      <span className="min-w-0">{error}</span>
    </p>
  );
};
