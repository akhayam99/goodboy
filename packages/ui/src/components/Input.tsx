import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';

export type FieldSize = 'sm' | 'md';

export type InputProps = Omit<ComponentProps<'input'>, 'size'> & {
  size?: FieldSize;
};

export const FIELD_SIZE_CLASSES = {
  sm: 'h-7 px-2',
  md: 'h-8 px-3',
} as const satisfies Record<FieldSize, string>;

export const Input = ({ className, type = 'text', size = 'sm', ...rest }: InputProps) => {
  return (
    <input
      type={type}
      data-size={size}
      className={cn(
        'w-full rounded-md border border-border bg-background text-ui text-foreground placeholder:text-faint-foreground',
        FOCUS_RING,
        'disabled:bg-fill disabled:text-disabled-foreground',
        FIELD_SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    />
  );
};
