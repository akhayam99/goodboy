import { useRef } from 'react';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../cn';
import { ICON_SIZE } from '../iconSize';
import { IconButton } from './IconButton';
import type { FieldSize } from './Input';

export type SearchFieldProps = Omit<
  ComponentProps<'input'>,
  'size' | 'value' | 'onChange' | 'type' | 'aria-label' | 'ref'
> & {
  readonly ariaLabel: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly size?: FieldSize;
  readonly clearLabel?: string;
  readonly hint?: ReactNode;
  readonly inputRef?: Ref<HTMLInputElement>;
};

const FIELD_HEIGHT_CLASSES = {
  sm: 'h-7',
  md: 'h-8',
} as const satisfies Record<FieldSize, string>;

export const SearchField = ({
  ariaLabel,
  value,
  onChange,
  size = 'sm',
  clearLabel = 'Clear search',
  hint,
  inputRef,
  className,
  ...rest
}: SearchFieldProps) => {
  const ownRef = useRef<HTMLInputElement | null>(null);
  const hasValue = value !== '';

  const attach = (node: HTMLInputElement | null) => {
    ownRef.current = node;
    if (typeof inputRef === 'function') {
      inputRef(node);
      return;
    }
    if (inputRef != null) {
      inputRef.current = node;
    }
  };

  const clear = () => {
    onChange('');
    ownRef.current?.focus();
  };

  return (
    <div
      data-size={size}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 focus-within:ring-2 focus-within:ring-focus-ring',
        FIELD_HEIGHT_CLASSES[size],
        hasValue && 'pr-1',
        className,
      )}
    >
      <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
      <input
        {...rest}
        ref={attach}
        type="search"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-ui text-foreground outline-none ring-0 placeholder:text-faint-foreground focus-visible:outline-none disabled:text-disabled-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {hasValue ? <IconButton size="xs" icon={X} label={clearLabel} onClick={clear} /> : null}
      {!hasValue && hint != null ? (
        <span className="pointer-events-none flex shrink-0 items-center">{hint}</span>
      ) : null}
    </div>
  );
};
