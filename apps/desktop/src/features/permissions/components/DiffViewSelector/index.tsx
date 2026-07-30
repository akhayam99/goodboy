import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, GitCommit } from 'lucide-react';
import { Divider, Popover, ScrollFade, cn } from '@goodboy/ui';
import type { BranchCommit, DiffView, WorktreeStatus } from '@goodboy/types';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { DropdownPortal } from '../../../../shared/hooks/useDropdown/DropdownPortal';
import { useDropdown } from '../../../../shared/hooks/useDropdown';

type Props = {
  readonly view: DiffView;
  readonly onChange: (next: DiffView) => void;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly status: WorktreeStatus | null;
  readonly filesCount: number | null;
  readonly loading?: boolean;
};

type OptionRow = {
  readonly kind: 'option';
  readonly view: DiffView;
  readonly label: string;
  readonly commit?: BranchCommit;
};

type PlaceholderRow = {
  readonly kind: 'placeholder';
  readonly label: string;
};

type SectionRow = OptionRow | PlaceholderRow;

type Section = {
  readonly label: string;
  readonly rows: ReadonlyArray<SectionRow>;
};

type ViewLabelParams = {
  readonly view: DiffView;
  readonly commits: ReadonlyArray<BranchCommit>;
};

type RelativeTimeParams = {
  readonly timestamp: number;
};

type ViewEqualsParams = {
  readonly left: DiffView;
  readonly right: DiffView;
};

type NextFocusIndexParams = {
  readonly currentIndex: number;
  readonly direction: 1 | -1;
  readonly optionCount: number;
};

type SelectViewParams = {
  readonly next: DiffView;
};

const SCOPE_LABEL: Record<'working' | 'unstaged' | 'staged' | 'all', string> = {
  working: 'working tree',
  unstaged: 'unstaged only',
  staged: 'staged only',
  all: 'working tree',
};

const viewLabel = ({ view, commits }: ViewLabelParams): string => {
  if (view.kind === 'working') {
    if (view.scope === 'all') {
      return 'working tree';
    }

    return SCOPE_LABEL[view.scope];
  }

  if (view.kind === 'commit') {
    const commit = commits.find((candidate) => candidate.sha === view.sha);
    if (commit != null) {
      return `commit ${commit.shortSha}`;
    }

    return `commit ${view.sha.slice(0, 7)}`;
  }

  return 'branch vs main';
};

const relativeTime = ({ timestamp }: RelativeTimeParams): string => {
  const now = Date.now() / 1000;
  const delta = Math.max(0, now - timestamp);
  if (delta < 60) {
    return `${Math.floor(delta)}s`;
  }

  if (delta < 3600) {
    return `${Math.floor(delta / 60)}min`;
  }

  if (delta < 86400) {
    return `${Math.floor(delta / 3600)}h`;
  }

  if (delta < 86400 * 7) {
    return `${Math.floor(delta / 86400)}d`;
  }

  if (delta < 86400 * 30) {
    return `${Math.floor(delta / (86400 * 7))}w`;
  }

  return `${Math.floor(delta / (86400 * 30))}mo`;
};

const viewEquals = ({ left, right }: ViewEqualsParams): boolean => {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === 'working' && right.kind === 'working') {
    return left.scope === right.scope;
  }

  if (left.kind === 'commit' && right.kind === 'commit') {
    return left.sha === right.sha;
  }

  return true;
};

const nextFocusIndex = ({ currentIndex, direction, optionCount }: NextFocusIndexParams): number => {
  if (optionCount === 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction === 1 ? 0 : optionCount - 1;
  }

  const nextIndex = currentIndex + direction;
  return Math.max(0, Math.min(optionCount - 1, nextIndex));
};

export const DiffViewSelector = ({
  view,
  onChange,
  commits,
  status,
  filesCount,
  loading,
}: Props) => {
  const {
    open,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
    popupStyle,
    portal,
    portalTarget,
  } = useDropdown({
    expectedHeight: 440,
    expectedWidth: 440,
    width: 'w-[440px] max-w-[calc(100vw-2rem)]',
    strategy: 'fixed',
  });
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const localCommits = useMemo(() => commits.filter((commit) => !commit.pushed), [commits]);
  const pushedCommits = useMemo(() => commits.filter((commit) => commit.pushed), [commits]);

  const filterMatch = useCallback(
    (commit: BranchCommit) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (normalizedQuery.length === 0) {
        return true;
      }

      return (
        commit.shortSha.toLowerCase().includes(normalizedQuery) ||
        commit.subject.toLowerCase().includes(normalizedQuery)
      );
    },
    [query],
  );

  const sections = useMemo<ReadonlyArray<Section>>(() => {
    const filteredLocalCommits = localCommits.filter(filterMatch);
    const readyRows: ReadonlyArray<SectionRow> =
      localCommits.length === 0
        ? [{ kind: 'placeholder', label: 'nothing to push' }]
        : filteredLocalCommits.length === 0
          ? [{ kind: 'placeholder', label: 'no match' }]
          : filteredLocalCommits.map((commit) => ({
              kind: 'option',
              view: { kind: 'commit', sha: commit.sha },
              label: commit.subject,
              commit,
            }));
    const filteredPushedCommits = pushedCommits.filter(filterMatch);
    const originRows: ReadonlyArray<SectionRow> =
      pushedCommits.length === 0
        ? [
            {
              kind: 'placeholder',
              label:
                status?.hasUpstream === false ? 'branch not pushed yet' : 'no commits pushed yet',
            },
          ]
        : filteredPushedCommits.length === 0
          ? [{ kind: 'placeholder', label: 'no match' }]
          : filteredPushedCommits.map((commit) => ({
              kind: 'option',
              view: { kind: 'commit', sha: commit.sha },
              label: commit.subject,
              commit,
            }));

    return [
      {
        label: 'currently editing',
        rows: [
          {
            kind: 'option',
            view: { kind: 'working', scope: 'all' },
            label: 'working tree',
          },
          {
            kind: 'option',
            view: { kind: 'working', scope: 'staged' },
            label: 'staged only',
          },
          {
            kind: 'option',
            view: { kind: 'working', scope: 'unstaged' },
            label: 'unstaged only',
          },
        ],
      },
      { label: 'ready to push', rows: readyRows },
      { label: 'on origin', rows: originRows },
      {
        label: 'presets',
        rows: [{ kind: 'option', view: { kind: 'branch' }, label: 'branch vs main' }],
      },
    ];
  }, [filterMatch, localCommits, pushedCommits, status?.hasUpstream]);

  const options = useMemo(
    () =>
      sections.flatMap((section) =>
        section.rows.filter((row): row is OptionRow => row.kind === 'option'),
      ),
    [sections],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
    setFocusIndex(-1);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  const selectView = ({ next }: SelectViewParams) => {
    onChange(next);
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusIndex((currentIndex) =>
        nextFocusIndex({ currentIndex, direction: 1, optionCount: options.length }),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusIndex((currentIndex) =>
        nextFocusIndex({ currentIndex, direction: -1, optionCount: options.length }),
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const focusedOption = options[focusIndex];
      if (focusedOption != null) {
        selectView({ next: focusedOption.view });
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const label = viewLabel({ view, commits });
  const countLabel =
    filesCount === null ? '' : ` · ${filesCount} file${filesCount === 1 ? '' : 's'}`;
  let optionIndex = -1;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
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
          <span className="text-muted-foreground/70 tabular-nums">{countLabel}</span>
        )}
        <ChevronDown size={11} aria-hidden className="text-muted-foreground/70" />
      </button>

      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open && (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel="diff view"
            className={cn(popupClassName, 'flex flex-col bg-subtle')}
            style={popupStyle}
          >
            <div className="px-2.5 py-2">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setFocusIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="filter commits by sha or subject…"
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                aria-label="filter commits"
              />
            </div>
            <Divider />
            <ScrollFade fadeFrom="subtle" className="max-h-[400px]">
              <div className="flex flex-col gap-0.5 py-1" onKeyDown={handleKeyDown}>
                {sections.map((section) => (
                  <PickerSection key={section.label} label={section.label}>
                    <div className="flex flex-col gap-0.5 px-1">
                      {section.rows.map((row) => {
                        if (row.kind === 'placeholder') {
                          return (
                            <span
                              key={`${section.label}-${row.label}`}
                              className="px-1.5 py-1 text-[11px] italic text-muted-foreground/50"
                            >
                              {row.label}
                            </span>
                          );
                        }

                        optionIndex += 1;
                        const currentOptionIndex = optionIndex;
                        const isActive = viewEquals({ left: view, right: row.view });
                        const isFocused = currentOptionIndex === focusIndex;
                        return (
                          <button
                            key={`${section.label}-${row.label}-${currentOptionIndex}`}
                            type="button"
                            aria-pressed={isActive}
                            onMouseEnter={() => setFocusIndex(currentOptionIndex)}
                            onClick={() => selectView({ next: row.view })}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                              isActive
                                ? 'bg-background text-foreground shadow-sm ring-1 ring-inset ring-border-soft'
                                : 'text-foreground/85 hover:bg-background/60',
                              isFocused && !isActive && 'bg-background/60 text-foreground',
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                'size-1.5 shrink-0 rounded-full ring-1 ring-inset',
                                isActive
                                  ? 'bg-primary ring-primary/40'
                                  : 'bg-transparent ring-transparent',
                              )}
                            />
                            {row.commit != null ? (
                              <>
                                <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                                  {row.commit.shortSha}
                                </span>
                                <span
                                  className="min-w-0 flex-1 truncate"
                                  title={row.commit.subject}
                                >
                                  {row.commit.subject}
                                </span>
                                {row.commit.pushed && (
                                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                                    pushed
                                  </span>
                                )}
                                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                                  {relativeTime({ timestamp: row.commit.timestamp })}
                                </span>
                              </>
                            ) : (
                              <span className="min-w-0 flex-1 truncate">{row.label}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </PickerSection>
                ))}
              </div>
            </ScrollFade>
          </Popover>
        )}
      </DropdownPortal>
    </div>
  );
};
