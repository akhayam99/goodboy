import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { AnchoredPopover, Chip, cn, ScrollFade, useDropdown, tintClasses } from '@goodboy/ui';
import type { BranchCommit, DiffView, WorktreeStatus } from '@goodboy/types';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { formatAdaptiveAge } from '../../../../shared/utils/time/formatAdaptiveAge';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly view: DiffView;
  readonly onChange: (next: DiffView) => void;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly status: WorktreeStatus | null;
  readonly baseBranch?: string | null;
  readonly branch?: string | null;
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
  readonly hint?: string;
  readonly rows: ReadonlyArray<SectionRow>;
};

type ViewLabelParams = {
  readonly view: DiffView;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly baseBranch: string | null;
  readonly branch: string | null;
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
  working: 'Working tree',
  unstaged: 'Unstaged only',
  staged: 'Staged only',
  all: 'Working tree',
};

const baseWord = (baseBranch: string | null): string => baseBranch ?? 'its base branch';

const viewLabel = ({ view, commits, baseBranch, branch }: ViewLabelParams): string => {
  if (view.kind === 'working') {
    return SCOPE_LABEL[view.scope];
  }

  if (view.kind === 'commit') {
    const commit = commits.find((candidate) => candidate.sha === view.sha);
    if (commit != null) {
      return `Commit ${commit.shortSha}`;
    }

    return `Commit ${view.sha.slice(0, 7)}`;
  }

  return `Comparing ${baseWord(baseBranch)} ← ${branch ?? 'this branch'}`;
};

const commitsLabel = ({
  view,
  commits,
}: Pick<ViewLabelParams, 'view' | 'commits'>): string | null => {
  if (view.kind !== 'branch' || commits.length === 0) {
    return null;
  }

  return `All ${commits.length} ${commits.length === 1 ? 'commit' : 'commits'}`;
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
  baseBranch = null,
  branch = null,
  loading,
}: Props) => {
  const now = useNow(30_000);
  const dropdown = useDropdown({
    expectedHeight: 440,
    expectedWidth: 440,
    width: 'w-[440px] max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
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

  const hasQuery = query.trim().length > 0;

  const sections = useMemo<ReadonlyArray<Section>>(() => {
    const filteredLocalCommits = localCommits.filter(filterMatch);
    const filteredPushedCommits = pushedCommits.filter(filterMatch);
    const commitRows = ({
      matches,
    }: {
      readonly matches: ReadonlyArray<BranchCommit>;
    }): ReadonlyArray<SectionRow> =>
      matches.map((commit) => ({
        kind: 'option',
        view: { kind: 'commit', sha: commit.sha },
        label: commit.subject,
        commit,
      }));

    const commitSections: Section[] = [];
    if (hasQuery) {
      if (filteredLocalCommits.length > 0) {
        commitSections.push({
          label: 'ready to push',
          rows: commitRows({ matches: filteredLocalCommits }),
        });
      }
      if (filteredPushedCommits.length > 0) {
        commitSections.push({
          label: 'on origin',
          rows: commitRows({ matches: filteredPushedCommits }),
        });
      }
    } else {
      commitSections.push({
        label: 'ready to push',
        rows:
          localCommits.length === 0
            ? [{ kind: 'placeholder', label: 'nothing to push' }]
            : commitRows({ matches: localCommits }),
      });
      commitSections.push({
        label: 'on origin',
        rows:
          pushedCommits.length === 0
            ? [
                {
                  kind: 'placeholder',
                  label:
                    status != null && status.upstream == null
                      ? 'branch not pushed yet'
                      : 'no commits pushed yet',
                },
              ]
            : commitRows({ matches: pushedCommits }),
      });
    }

    return [
      {
        label: 'branch',
        hint: `everything this branch changes vs ${baseWord(baseBranch)}, uncommitted edits included`,
        rows: [
          {
            kind: 'option',
            view: { kind: 'branch' },
            label: `branch vs ${baseWord(baseBranch)}`,
          },
        ],
      },
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
      ...commitSections,
    ];
  }, [baseBranch, filterMatch, hasQuery, localCommits, pushedCommits, status?.upstream]);

  const hasCommitMatch = useMemo(
    () =>
      sections.some((section) =>
        section.rows.some((row) => row.kind === 'option' && row.commit != null),
      ),
    [sections],
  );

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

  const label = viewLabel({ view, commits, baseBranch, branch });
  const countLabel = commitsLabel({ view, commits });
  let optionIndex = -1;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Diff view"
      className="flex flex-col bg-subtle"
      trigger={
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-label text-muted-foreground',
            'hover:bg-hover hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          )}
          title="Change diff view"
        >
          <span className="truncate">{label}</span>
          {loading ? (
            <span className="text-faint-foreground">…</span>
          ) : countLabel === null ? null : (
            <span className="shrink-0 text-faint-foreground tabular-nums">· {countLabel}</span>
          )}
          <ChevronDown
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-faint-foreground"
          />
        </button>
      }
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setFocusIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="filter commits by sha or subject…"
          className="w-full bg-transparent text-label outline-none placeholder:text-faint-foreground"
          aria-label="Filter commits"
        />
      </div>
      <ScrollFade fadeFrom="subtle" className="max-h-[400px]">
        <div className="flex flex-col gap-0.5 py-1" onKeyDown={handleKeyDown}>
          {sections.map((section) => (
            <PickerSection key={section.label} label={section.label} hint={section.hint}>
              <div className="flex flex-col gap-0.5 px-1">
                {section.rows.map((row) => {
                  if (row.kind === 'placeholder') {
                    return (
                      <span
                        key={`${section.label}-${row.label}`}
                        className="px-2 py-1 text-meta italic text-faint-foreground"
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
                        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-label transition-colors',
                        isActive
                          ? 'bg-background text-foreground shadow-sm ring-1 ring-inset ring-border-soft'
                          : 'text-foreground hover:bg-background',
                        isFocused && !isActive && 'bg-background text-foreground',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'size-1.5 shrink-0 rounded-full ring-1 ring-inset',
                          isActive
                            ? cn('bg-primary', tintClasses('primary').ringStrong)
                            : 'bg-transparent ring-transparent',
                        )}
                      />
                      {row.commit != null ? (
                        <>
                          <span className="shrink-0 font-mono text-meta text-muted-foreground">
                            {row.commit.shortSha}
                          </span>
                          <span className="min-w-0 flex-1 truncate" title={row.commit.subject}>
                            {row.commit.subject}
                          </span>
                          {row.commit.pushed && (
                            <Chip
                              tone="neutral"
                              kind="state"
                              bordered={false}
                              label="pushed"
                              className="shrink-0"
                            />
                          )}
                          <span className="shrink-0 text-meta text-faint-foreground">
                            {formatAdaptiveAge({ at: row.commit.timestamp * 1000, now })}
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
          {hasQuery && !hasCommitMatch ? (
            <span className="px-4 py-1 text-meta italic text-faint-foreground">
              no commits match
            </span>
          ) : null}
        </div>
      </ScrollFade>
    </AnchoredPopover>
  );
};
