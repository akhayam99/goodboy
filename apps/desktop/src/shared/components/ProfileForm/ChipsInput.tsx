import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, useDropdown } from '@goodboy/ui';
import { chipsInputOptions, type ChipSuggestion } from './chipsInputOptions';

type Props = {
  readonly label: string;
  readonly values: ReadonlyArray<string>;
  readonly placeholder: string;
  readonly disabled?: boolean;
  readonly suggest?: (params: {
    readonly query: string;
    readonly values: ReadonlyArray<string>;
  }) => ReadonlyArray<ChipSuggestion>;
  readonly customLabel: (params: { readonly query: string }) => string;
  readonly onChange: (values: ReadonlyArray<string>) => void;
};

export const ChipsInput = ({
  label,
  values,
  placeholder,
  disabled = false,
  suggest,
  customLabel,
  onChange,
}: Props) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const dropdown = useDropdown({ expectedHeight: 240, isEscapeEnabled: false });
  const options = useMemo(
    () =>
      chipsInputOptions({
        query,
        values,
        suggestions: suggest?.({ query, values }) ?? [],
        customLabel,
      }),
    [customLabel, query, suggest, values],
  );
  const shouldOpen = isFocused && suggest !== undefined && options.length > 0;
  const { open, toggle } = dropdown;

  useEffect(() => {
    if (shouldOpen === open) {
      return;
    }
    toggle();
  }, [open, shouldOpen, toggle]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const add = ({ value }: { readonly value: string }) => {
    setQuery('');
    if (values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      return;
    }
    onChange([...values, value]);
  };

  const remove = ({ value }: { readonly value: string }) => {
    onChange(values.filter((existing) => existing !== value));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && options.length > 0) {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, options.length - 1));
      return;
    }
    if (event.key === 'ArrowUp' && options.length > 0) {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      const option = options[highlight] ?? options[0];
      if (option === undefined) {
        return;
      }
      event.preventDefault();
      add({ value: option.value });
      return;
    }
    if (event.key === 'Escape' && query !== '') {
      event.preventDefault();
      event.stopPropagation();
      setQuery('');
      return;
    }
    if (event.key === 'Backspace' && query === '' && values.length > 0) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  };

  const highlighted = open ? options[highlight] : undefined;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="listbox"
      ariaLabel={`${label} suggestions`}
      className="max-h-60 overflow-y-auto py-1"
      anchorClassName="w-full"
      trigger={
        <div
          className={cn(
            'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 motion-safe:transition-colors focus-within:border-primary',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex h-6 items-center gap-1 rounded-sm bg-subtle pl-2 pr-0.5 text-label text-foreground"
            >
              {value}
              <Tooltip content={`Remove ${value}`} anchorClassName="flex">
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    remove({ value });
                  }}
                  className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-hover hover:text-foreground"
                >
                  <X size={11} aria-hidden />
                </button>
              </Tooltip>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={query}
            aria-label={label}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={highlighted === undefined ? undefined : `${listId}-${highlight}`}
            autoComplete="off"
            disabled={disabled}
            placeholder={values.length === 0 ? placeholder : ''}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="h-6 min-w-24 flex-1 bg-transparent px-1 text-body text-foreground outline-none placeholder:text-faint-foreground"
          />
        </div>
      }
    >
      <ul id={listId} className="flex flex-col">
        {options.map((option, index) => {
          const previousGroup = index === 0 ? undefined : options[index - 1]?.group;
          const isGroupStart = option.group !== undefined && option.group !== previousGroup;
          return (
            <li key={option.key} className="flex flex-col">
              {isGroupStart ? (
                <span className="px-3 pb-1 pt-2 text-meta font-medium uppercase tracking-eyebrow text-faint-foreground">
                  {option.group}
                </span>
              ) : null}
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === highlight}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => add({ value: option.value })}
                className={cn(
                  'mx-1 rounded-sm px-2 py-1 text-left text-body',
                  option.isCustom ? 'text-muted-foreground' : 'text-foreground',
                  index === highlight && 'bg-hover',
                )}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    </AnchoredPopover>
  );
};
