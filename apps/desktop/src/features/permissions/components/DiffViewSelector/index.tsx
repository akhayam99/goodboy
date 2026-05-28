import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, GitCommit } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { BranchCommit, DiffView, WorktreeStatus } from '@goodboy/types';

interface Props {
  view: DiffView;
  onChange: (next: DiffView) => void;
  commits: ReadonlyArray<BranchCommit>;
  status: WorktreeStatus | null;
  filesCount: number | null;
  loading?: boolean;
}

type Row =
  | { kind: 'header'; label: string; badge?: string }
  | { kind: 'option'; view: DiffView; label: string; meta?: string; badge?: string }
  | { kind: 'placeholder'; label: string };

const SCOPE_LABEL: Record<'working' | 'unstaged' | 'staged' | 'all', string> = {
  working: 'working tree',
  unstaged: 'unstaged only',
  staged: 'staged only',
  all: 'working tree',
};

function viewLabel(view: DiffView, commits: ReadonlyArray<BranchCommit>): string {
  if (view.kind === 'working') {
    if (view.scope === 'all') return 'working tree';
    return SCOPE_LABEL[view.scope];
  }
  if (view.kind === 'commit') {
    const found = commits.find((c) => c.sha === view.sha);
    if (found) return `commit ${found.shortSha}`;
    return `commit ${view.sha.slice(0, 7)}`;
  }
  return 'branch vs main';
}

function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const delta = Math.max(0, now - ts);
  if (delta < 60) return `${Math.floor(delta)}s`;
  if (delta < 3600) return `${Math.floor(delta / 60)}min`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h`;
  if (delta < 86400 * 7) return `${Math.floor(delta / 86400)}d`;
  if (delta < 86400 * 30) return `${Math.floor(delta / (86400 * 7))}w`;
  return `${Math.floor(delta / (86400 * 30))}mo`;
}

function viewEquals(a: DiffView, b: DiffView): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'working' && b.kind === 'working') return a.scope === b.scope;
  if (a.kind === 'commit' && b.kind === 'commit') return a.sha === b.sha;
  return true;
}

export function DiffViewSelector({ view, onChange, commits, status, filesCount, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const localCommits = useMemo(() => commits.filter((c) => !c.pushed), [commits]);
  const pushedCommits = useMemo(() => commits.filter((c) => c.pushed), [commits]);

  const filterMatch = useCallback(
    (c: BranchCommit) => {
      const q = query.trim().toLowerCase();
      if (q.length === 0) return true;
      return c.shortSha.includes(q) || c.subject.toLowerCase().includes(q);
    },
    [query],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    out.push({ kind: 'header', label: 'currently editing' });
    out.push({ kind: 'option', view: { kind: 'working', scope: 'all' }, label: 'working tree' });
    out.push({
      kind: 'option',
      view: { kind: 'working', scope: 'staged' },
      label: 'staged only',
    });
    out.push({
      kind: 'option',
      view: { kind: 'working', scope: 'unstaged' },
      label: 'unstaged only',
    });

    const filteredLocal = localCommits.filter(filterMatch);
    out.push({ kind: 'header', label: 'ready to push' });
    if (localCommits.length === 0) {
      out.push({ kind: 'placeholder', label: 'nothing to push' });
    } else if (filteredLocal.length === 0) {
      out.push({ kind: 'placeholder', label: 'no match' });
    } else {
      for (const c of filteredLocal) {
        out.push({
          kind: 'option',
          view: { kind: 'commit', sha: c.sha },
          label: `${c.shortSha}  ${c.subject}`,
          meta: relativeTime(c.timestamp),
        });
      }
    }

    const filteredPushed = pushedCommits.filter(filterMatch);
    out.push({ kind: 'header', label: 'on origin' });
    if (pushedCommits.length === 0) {
      out.push({
        kind: 'placeholder',
        label: status?.hasUpstream === false ? 'branch not pushed yet' : 'no commits pushed yet',
      });
    } else if (filteredPushed.length === 0) {
      out.push({ kind: 'placeholder', label: 'no match' });
    } else {
      for (const c of filteredPushed) {
        out.push({
          kind: 'option',
          view: { kind: 'commit', sha: c.sha },
          label: `${c.shortSha}  ${c.subject}`,
          meta: relativeTime(c.timestamp),
        });
      }
    }

    out.push({ kind: 'header', label: 'presets' });
    out.push({ kind: 'option', view: { kind: 'branch' }, label: 'branch vs main' });

    return out;
  }, [localCommits, pushedCommits, filterMatch, query, status]);

  const optionIndices = useMemo(
    () =>
      rows.reduce<number[]>((acc, r, i) => {
        if (r.kind === 'option') acc.push(i);
        return acc;
      }, []),
    [rows],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setFocusIdx(0);
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  const moveFocus = (dir: 1 | -1) => {
    if (optionIndices.length === 0) return;
    const currentPos = optionIndices.findIndex((i) => i === focusIdx);
    const startPos = currentPos === -1 ? (dir === 1 ? -1 : optionIndices.length) : currentPos;
    const nextPos = Math.max(0, Math.min(optionIndices.length - 1, startPos + dir));
    const targetIdx = optionIndices[nextPos];
    if (targetIdx !== undefined) setFocusIdx(targetIdx);
  };

  const commitOption = (v: DiffView) => {
    onChange(v);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[focusIdx];
      if (row?.kind === 'option') commitOption(row.view);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const label = viewLabel(view, commits);
  const countStr = filesCount === null ? '' : ` · ${filesCount} file${filesCount === 1 ? '' : 's'}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs',
          'hover:border-foreground/30 hover:bg-muted/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        )}
        title="change diff view"
      >
        <GitCommit size={11} aria-hidden className="text-muted-foreground" />
        <span className="font-medium">{label}</span>
        {loading ? (
          <span className="text-muted-foreground/60">…</span>
        ) : (
          <span className="text-muted-foreground/70 tabular-nums">{countStr}</span>
        )}
        <ChevronDown size={11} aria-hidden className="text-muted-foreground/70" />
      </button>

      {open ? (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- captures keys for menu nav
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-[440px] overflow-hidden rounded-md border border-border bg-subtle shadow-lg"
          onKeyDown={handleKey}
        >
          <div className="border-b border-border-soft px-2 py-1.5">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocusIdx(0);
              }}
              placeholder="filter commits by sha or subject…"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
              aria-label="filter commits"
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto py-1">
            {rows.map((row, i) => {
              if (row.kind === 'header') {
                return (
                  <div
                    key={`h-${i}`}
                    className="mt-1 flex items-center justify-between px-2 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    <span>{row.label}</span>
                    {row.badge ? (
                      <span className="rounded-sm bg-warning/15 px-1 py-px text-[8px] font-medium text-warning">
                        {row.badge}
                      </span>
                    ) : null}
                  </div>
                );
              }
              if (row.kind === 'placeholder') {
                return (
                  <div
                    key={`p-${i}`}
                    className="px-2 py-1 text-[11px] italic text-muted-foreground/50"
                  >
                    {row.label}
                  </div>
                );
              }
              const isActive = viewEquals(view, row.view);
              const isFocused = i === focusIdx;
              return (
                <button
                  key={`o-${i}`}
                  type="button"
                  onMouseEnter={() => setFocusIdx(i)}
                  onClick={() => commitOption(row.view)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-1 text-left text-xs',
                    isFocused ? 'bg-muted/60' : 'hover:bg-muted/30',
                  )}
                >
                  <span
                    className={cn(
                      'w-2 shrink-0 text-center text-[10px]',
                      isActive ? 'text-primary' : 'text-transparent',
                    )}
                    aria-hidden
                  >
                    ●
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate font-mono',
                      isActive ? 'text-foreground' : 'text-foreground/85',
                    )}
                    title={row.label}
                  >
                    {row.label}
                  </span>
                  {row.badge ? (
                    <span className="shrink-0 rounded-sm bg-warning/15 px-1 py-px text-[8px] font-medium text-warning">
                      {row.badge}
                    </span>
                  ) : null}
                  {row.meta ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                      {row.meta}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
