import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnchoredPopover, cn, ScrollFade, Tooltip, useDropdown } from '@goodboy/ui';
import { ChevronDown } from 'lucide-react';
import type { LocalBranchInfo } from './worktree';
import { ICON_SIZE } from '../../shared/components/conceptIcons';

type Props = {
  readonly branches: ReadonlyArray<LocalBranchInfo>;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly excludeNames?: ReadonlyArray<string>;
};

type SelectParams = {
  readonly name: string;
};

export const BranchCombobox = ({
  branches,
  value,
  onChange,
  disabled,
  loading,
  excludeNames,
}: Props) => {
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdown = useDropdown({
    disabled: disabled || branches.length === 0,
    expectedHeight: 224,
  });
  const { open, close, toggle } = dropdown;

  const excludeSet = useMemo(() => new Set(excludeNames ?? []), [excludeNames]);

  const filtered = useMemo(
    () =>
      branches.filter(
        (b) => !excludeSet.has(b.name) && b.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [branches, excludeSet, query],
  );

  const select = useCallback(
    ({ name }: SelectParams) => {
      onChange(name);
      setQuery(name);
      close();
    },
    [close, onChange],
  );

  useEffect(() => {
    if (value !== '' && query === '') {
      setQuery(value);
    }
  }, [value, query]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || listRef.current == null) {
      return;
    }
    const highlightedOption = listRef.current.children.item(highlightIdx);
    if (!(highlightedOption instanceof HTMLElement)) {
      return;
    }
    highlightedOption.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      toggle();
      e.preventDefault();
      return;
    }
    if (!open) {
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        return;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx] != null) {
          select({ name: filtered[highlightIdx].name });
        }
        return;
      case 'Escape':
        e.preventDefault();
        close();
        return;
    }
  };

  const placeholder = loading
    ? 'Loading…'
    : branches.length === 0
      ? 'No local branches'
      : 'Search branch…';

  const isListVisible = open && filtered.length > 0;
  const isNoMatchesVisible = open && !loading && filtered.length === 0 && query !== '';
  const isPopupVisible = isListVisible || isNoMatchesVisible;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      className={cn('bg-subtle', isNoMatchesVisible && 'px-2 py-2 text-xs text-muted-foreground')}
      anchorClassName="w-full"
      trigger={
        <div
          className={cn(
            'flex h-9 w-full items-center gap-1 rounded-md border border-border bg-background px-1 motion-safe:transition-colors focus-within:border-primary hover:border-border-strong',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={placeholder}
            disabled={disabled || branches.length === 0}
            aria-label="Branch"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            autoComplete="off"
            className="flex-1 truncate bg-transparent px-2 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) {
                toggle();
              }
              if (e.target.value === '') {
                onChange('');
              }
            }}
            onFocus={() => {
              if (!open) {
                toggle();
              }
            }}
            onKeyDown={onKeyDown}
          />
          <Tooltip content={open ? 'Close branch list' : 'Open branch list'}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                if (disabled || branches.length === 0) {
                  return;
                }
                toggle();
                if (open) {
                  inputRef.current?.focus();
                }
              }}
              aria-label={open ? 'Close branch list' : 'Open branch list'}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronDown
                size={ICON_SIZE.row}
                aria-hidden
                className={cn('motion-safe:transition-transform', open && 'rotate-180')}
              />
            </button>
          </Tooltip>
        </div>
      }
    >
      {isPopupVisible ? (
        isListVisible ? (
          <ScrollFade className="max-h-56" viewportClassName="py-0.5" fadeFrom="subtle">
            <ul ref={listRef} role="listbox">
              {filtered.map((b, i) => (
                <li
                  key={b.name}
                  role="option"
                  aria-selected={highlightIdx === i}
                  onMouseEnter={() => setHighlightIdx(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select({ name: b.name });
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm font-mono',
                    highlightIdx === i ? 'bg-primary/10 text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {b.inUse ? <span className="shrink-0 text-2xs text-warning">in use</span> : null}
                  {b.hasUncommitted ? (
                    <span className="shrink-0 text-2xs text-warning">dirty</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollFade>
        ) : (
          'No matching branches'
        )
      ) : null}
    </AnchoredPopover>
  );
};
