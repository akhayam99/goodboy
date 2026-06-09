import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import { ChevronDown } from 'lucide-react';
import type { LocalBranchInfo } from './worktree';

type Props = {
  readonly branches: ReadonlyArray<LocalBranchInfo>;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly excludeNames?: ReadonlyArray<string>;
  readonly openDirection?: 'down' | 'up';
};

export const BranchCombobox = ({
  branches,
  value,
  onChange,
  disabled,
  loading,
  excludeNames,
  openDirection = 'down',
}: Props) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const excludeSet = useMemo(() => new Set(excludeNames ?? []), [excludeNames]);

  const filtered = useMemo(
    () =>
      branches.filter(
        (b) => !excludeSet.has(b.name) && b.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [branches, excludeSet, query],
  );

  const select = useCallback(
    (name: string) => {
      onChange(name);
      setQuery(name);
      setOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (value && !query) {
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
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }
    const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
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
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx]) {
          select(filtered[highlightIdx].name);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  const placeholder = loading
    ? 'Loading…'
    : branches.length === 0
      ? 'No local branches'
      : 'Search branch…';

  const popupClass = cn(
    'absolute left-0 z-50 w-full overflow-y-auto rounded-md border border-border bg-subtle py-0.5 shadow-lg',
    openDirection === 'up' ? 'bottom-full mb-1 max-h-48' : 'top-full mt-1 max-h-56',
  );

  return (
    <div ref={containerRef} className="relative w-full">
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
            setOpen(true);
            if (!e.target.value) {
              onChange('');
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (disabled || branches.length === 0) {
              return;
            }
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
          aria-label={open ? 'Close branch list' : 'Open branch list'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown
            size={13}
            aria-hidden
            className={cn('transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>
      {open && filtered.length > 0 ? (
        <ul ref={listRef} role="listbox" className={popupClass}>
          {filtered.map((b, i) => (
            <li
              key={b.name}
              role="option"
              aria-selected={highlightIdx === i}
              onMouseEnter={() => setHighlightIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                select(b.name);
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
      ) : null}
      {open && !loading && filtered.length === 0 && query ? (
        <div className={cn(popupClass, 'px-2 py-2 text-xs text-muted-foreground')}>
          No matching branches
        </div>
      ) : null}
    </div>
  );
};
