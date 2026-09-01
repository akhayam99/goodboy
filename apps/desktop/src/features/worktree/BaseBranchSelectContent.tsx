import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, ScrollFade } from '@goodboy/ui';
import { listBranchNames } from './worktree';

type Props = {
  readonly repoPath: string;
  readonly value: string | null;
  readonly onCommit: (next: string | null) => void | Promise<void>;
  readonly onClose: () => void;
};

type CommitParams = {
  readonly candidate: string;
};

export const BaseBranchSelectContent = ({ repoPath, value, onCommit, onClose }: Props) => {
  const [query, setQuery] = useState(value ?? '');
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    let isCancelled = false;
    listBranchNames({ repoPath })
      .then((nextBranches) => {
        if (!isCancelled) {
          setBranches(nextBranches);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [repoPath]);

  const filteredBranches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery === '') {
      return branches;
    }
    return branches.filter((branch) => branch.toLowerCase().includes(normalizedQuery));
  }, [branches, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  const commit = ({ candidate }: CommitParams) => {
    const trimmed = candidate.trim();
    void onCommit(trimmed === '' ? null : trimmed);
    onClose();
  };

  return (
    <div className="flex w-64 flex-col gap-1.5 p-2">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Base branch"
        aria-expanded="true"
        aria-controls="base-branch-options"
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        placeholder="Search or enter a branch"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightIndex((current) =>
              Math.min(current + 1, Math.max(filteredBranches.length - 1, 0)),
            );
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightIndex((current) => Math.max(current - 1, 0));
            return;
          }
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          commit({ candidate: query });
        }}
        className="h-8 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {isLoading ? (
        <span className="px-1 text-2xs text-muted-foreground">Loading branches</span>
      ) : null}
      {hasError ? (
        <span className="px-1 text-2xs text-muted-foreground">Could not load branches</span>
      ) : null}
      {!isLoading && filteredBranches.length === 0 ? (
        <span className="px-1 text-2xs text-muted-foreground">No matching branches</span>
      ) : null}
      {filteredBranches.length > 0 ? (
        <ScrollFade className="max-h-44" viewportClassName="py-0.5" fadeFrom="subtle">
          <ul id="base-branch-options" role="listbox">
            {filteredBranches.map((branch, index) => (
              <li key={branch} role="option" aria-selected={index === highlightIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => commit({ candidate: branch })}
                  className={cn(
                    'flex w-full rounded px-2 py-1.5 text-left font-mono text-xs',
                    index === highlightIndex
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <span className="truncate">{branch}</span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollFade>
      ) : null}
      {value != null ? (
        <button
          type="button"
          onClick={() => commit({ candidate: '' })}
          className="rounded px-2 py-1.5 text-left text-2xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          Use default
        </button>
      ) : null}
    </div>
  );
};
