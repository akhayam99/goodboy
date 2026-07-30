import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn, Skeleton } from '@goodboy/ui';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { IssueCandidate } from '../../fetchIssueCandidates';

type Props = {
  readonly inputId?: string;
  readonly rows: ReadonlyArray<IssueCandidate>;
  readonly isLoading: boolean;
  readonly isLoaded: boolean;
  readonly error: string | null;
  readonly value: IssueCandidate | null;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly onOpen: () => void;
  readonly onPick: (candidate: IssueCandidate) => void;
  readonly onClear: () => void;
};

export const IssuePicker = ({
  inputId,
  rows,
  isLoading,
  isLoaded,
  error,
  value,
  placeholder,
  disabled,
  onOpen,
  onPick,
  onClear,
}: Props) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setQuery(value == null ? '' : `${value.identifier} ${value.title}`);
  }, [value]);

  const openPanel = () => {
    setIsOpen(true);
    onOpen();
  };

  const togglePanel = () => {
    if (disabled) {
      return;
    }
    setIsOpen(!isOpen);
    if (!isOpen) {
      onOpen();
    }
    inputRef.current?.focus();
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
      return rows;
    }
    return rows.filter(
      (row) =>
        row.identifier.toLowerCase().includes(needle) || row.title.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  const select = useCallback(
    (candidate: IssueCandidate) => {
      onPick(candidate);
      setQuery(`${candidate.identifier} ${candidate.title}`);
      setIsOpen(false);
    },
    [onPick],
  );

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (event: MouseEvent) => {
      if (containerRef.current != null && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || listRef.current == null) {
      return;
    }
    const element = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    element?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, isOpen]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      openPanel();
      event.preventDefault();
      return;
    }
    if (!isOpen) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightIdx((index) => Math.min(index + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightIdx((index) => Math.max(index - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const highlighted = filtered[highlightIdx];
        if (highlighted != null) {
          select(highlighted);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={cn(
          'flex h-9 w-full items-center gap-1 rounded-md border border-border bg-background px-1 motion-safe:transition-colors focus-within:border-primary hover:border-border-strong',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={query}
          placeholder={isLoading ? 'Loading issues…' : placeholder}
          disabled={disabled}
          aria-label={inputId === undefined ? 'Issue' : undefined}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoComplete="off"
          className="flex-1 truncate bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            if (event.target.value === '') {
              onClear();
            }
          }}
          onFocus={openPanel}
          onKeyDown={onKeyDown}
        />
        {value != null && value.url !== '' && (
          <a
            href={value.url}
            target="_blank"
            rel="noreferrer"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            aria-label="Open issue in browser"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={12} aria-hidden />
          </a>
        )}
        <button
          type="button"
          tabIndex={-1}
          onClick={togglePanel}
          aria-label={isOpen ? 'Close issue list' : 'Open issue list'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown
            size={13}
            aria-hidden
            className={cn('motion-safe:transition-transform', isOpen && 'rotate-180')}
          />
        </button>
      </div>

      {isOpen && isLoading && rows.length === 0 && (
        <div
          role="status"
          aria-label="Loading issues"
          className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-subtle py-0.5 shadow-lg"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2 px-2.5 py-1.5">
              <Skeleton className="h-3 w-12 shrink-0 rounded" />
              <Skeleton className="h-3 min-w-0 flex-1 rounded" />
            </div>
          ))}
        </div>
      )}

      {isOpen && error != null && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger shadow-lg">
          {error}
        </div>
      )}

      {isOpen && error == null && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-subtle py-0.5 shadow-lg"
        >
          {filtered.map((row, index) => (
            <li
              key={`${row.provider}:${row.externalId}`}
              role="option"
              aria-selected={highlightIdx === index}
              onMouseEnter={() => setHighlightIdx(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                select(row);
              }}
              className={cn(
                'flex cursor-pointer flex-col gap-0.5 px-2.5 py-1.5',
                highlightIdx === index && 'bg-primary/10',
              )}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                  {row.identifier}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{row.title}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOpen && error == null && !isLoading && isLoaded && filtered.length === 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-subtle px-3 py-2 text-xs text-muted-foreground shadow-lg">
          {query.trim() !== '' ? 'No matching issues' : 'No open issues assigned to you'}
        </div>
      )}
    </div>
  );
};
