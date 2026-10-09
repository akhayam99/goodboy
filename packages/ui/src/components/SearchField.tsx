import { useRef } from 'react';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../cn';
import { ICON_SIZE } from '../iconSize';
import { IconButton } from './IconButton';
import { FIELD_SIZE_CLASSES, type FieldSize } from './Input';

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
    <div data-size={size} className={cn('relative flex w-full items-center', className)}>
      <Search
        size={ICON_SIZE.row}
        aria-hidden
        className="pointer-events-none absolute left-2 shrink-0 text-muted-foreground"
      />
      <input
        {...rest}
        ref={attach}
        type="search"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-full appearance-none rounded-md border border-border bg-background text-label [&::-webkit-search-cancel-button]:hidden text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:bg-fill disabled:text-disabled-foreground',
          FIELD_SIZE_CLASSES[size],
          'pl-7',
          hasValue || hint != null ? 'pr-7' : '',
        )}
      />
      {hasValue ? (
        <span className="absolute right-0.5 flex items-center">
          <IconButton size="xs" icon={X} label={clearLabel} onClick={clear} />
        </span>
      ) : null}
      {!hasValue && hint != null ? (
        <span className="pointer-events-none absolute right-1 flex items-center">{hint}</span>
      ) : null}
    </div>
  );
};
