import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn, Skeleton } from '@goodboy/ui';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { linearFetchAssignedIssues, type LinearIssue } from './client';

type Props = {
  workspaceId: WorkspaceId;
  value: LinearIssue | null;
  onPick: (issue: LinearIssue) => void;
  onClear: () => void;
  disabled?: boolean;
};

export const IssuePicker = ({ workspaceId, value, onPick, onClear, disabled }: Props) => {
  const [issues, setIssues] = useState<ReadonlyArray<LinearIssue>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!value) {
      setQuery('');
    } else {
      setQuery(`${value.identifier} ${value.title}`);
    }
  }, [value]);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await linearFetchAssignedIssues(workspaceId);
      setIssues(rows);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const openPanel = () => {
    setOpen(true);
    if (!loaded && !loading) {
      void fetchIssues();
    }
  };

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return issues;
    }
    const q = query.toLowerCase();
    return issues.filter(
      (i) => i.identifier.toLowerCase().includes(q) || i.title.toLowerCase().includes(q),
    );
  }, [issues, query]);

  const select = useCallback(
    (issue: LinearIssue) => {
      onPick(issue);
      setQuery(`${issue.identifier} ${issue.title}`);
      setOpen(false);
    },
    [onPick],
  );

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
      openPanel();
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
          select(filtered[highlightIdx]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
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
          ref={inputRef}
          type="text"
          value={query}
          placeholder={loading ? 'Loading issues…' : 'Search Linear issues assigned to you…'}
          disabled={disabled}
          aria-label="Linear issue"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          className="flex-1 truncate bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) {
              onClear();
            }
          }}
          onFocus={openPanel}
          onKeyDown={onKeyDown}
        />
        {value ? (
          <a
            href={value.url}
            target="_blank"
            rel="noreferrer"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            aria-label="Open issue in Linear"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={12} aria-hidden />
          </a>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (disabled) {
              return;
            }
            if (open) {
              setOpen(false);
            } else {
              openPanel();
            }
            inputRef.current?.focus();
          }}
          aria-label={open ? 'Close issue list' : 'Open issue list'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown
            size={13}
            aria-hidden
            className={cn('motion-safe:transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>

      {open && loading && issues.length === 0 ? (
        <div
          role="status"
          aria-label="Loading issues"
          className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-subtle py-0.5 shadow-lg"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5">
              <Skeleton className="h-3 w-12 shrink-0 rounded" />
              <Skeleton className="h-3 min-w-0 flex-1 rounded" />
              <Skeleton className="h-3 w-10 shrink-0 rounded" />
            </div>
          ))}
        </div>
      ) : null}

      {open && error ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger shadow-lg">
          {error}
        </div>
      ) : null}

      {open && !error && filtered.length > 0 ? (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-subtle py-0.5 shadow-lg"
        >
          {filtered.map((issue, i) => (
            <li
              key={issue.id}
              role="option"
              aria-selected={highlightIdx === i}
              onMouseEnter={() => setHighlightIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                select(issue);
              }}
              className={cn(
                'flex cursor-pointer flex-col gap-0.5 px-2.5 py-1.5',
                highlightIdx === i ? 'bg-primary/10' : '',
              )}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                  {issue.identifier}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{issue.title}</span>
                <span className="shrink-0 text-2xs text-muted-foreground">{issue.state.name}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !error && !loading && loaded && filtered.length === 0 ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-subtle px-3 py-2 text-xs text-muted-foreground shadow-lg">
          {query.trim() ? 'No matching issues' : 'No open issues assigned to you'}
        </div>
      ) : null}
    </div>
  );
};
