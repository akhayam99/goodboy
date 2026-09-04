import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnchoredPopover,
  cn,
  EmptyState,
  ScrollFade,
  Skeleton,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { IssueCandidate } from '../../fetchIssueCandidates';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';

type Props = {
  readonly inputId?: string;
  readonly rows: ReadonlyArray<IssueCandidate>;
  readonly isLoading: boolean;
  readonly isLoaded: boolean;
  readonly error: string | null;
  readonly value: IssueCandidate | null;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly resolvePaste?: (rawValue: string) => IssueCandidate | null;
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
  resolvePaste,
  onOpen,
  onPick,
  onClear,
}: Props) => {
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdown = useDropdown({ disabled, expectedHeight: 288 });
  const { open: isOpen, close, toggle } = dropdown;

  useEffect(() => {
    setQuery(value == null ? '' : `${value.identifier} ${value.title}`);
  }, [value]);

  const openPanel = () => {
    if (!isOpen) {
      toggle();
    }
    onOpen();
  };

  const togglePanel = () => {
    if (disabled) {
      return;
    }
    if (isOpen) {
      close();
      inputRef.current?.focus();
      return;
    }
    if (document.activeElement === inputRef.current) {
      openPanel();
      return;
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

  const pasted = useMemo(
    () => (resolvePaste == null ? null : resolvePaste(query)),
    [resolvePaste, query],
  );
  const options = pasted != null ? [pasted] : filtered;

  const select = useCallback(
    (candidate: IssueCandidate) => {
      onPick(candidate);
      setQuery(`${candidate.identifier} ${candidate.title}`);
      close();
    },
    [close, onPick],
  );

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

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
        setHighlightIdx((index) => Math.min(index + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightIdx((index) => Math.max(index - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const highlighted = options[highlightIdx];
        if (highlighted != null) {
          select(highlighted);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        close();
        break;
    }
  };

  const isLoadingState = pasted == null && isLoading && rows.length === 0;
  const isErrorState = pasted == null && error != null;
  const hasOptions = (pasted != null || error == null) && options.length > 0;
  const isEmptyState = error == null && !isLoading && isLoaded && options.length === 0;
  const hasPopupContent = isLoadingState || isErrorState || hasOptions || isEmptyState;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      className={cn('bg-subtle', isErrorState && !hasOptions && 'border-danger/40 bg-danger/5')}
      anchorClassName="w-full"
      trigger={
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
              if (!isOpen) {
                toggle();
              }
              if (event.target.value === '') {
                onClear();
              }
            }}
            onFocus={openPanel}
            onKeyDown={onKeyDown}
          />
          {value != null && value.url !== '' && (
            <Tooltip content="Open issue in browser">
              <button
                type="button"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  void openUrl(value.url);
                }}
                aria-label="Open issue in browser"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink size={ICON_SIZE.row} aria-hidden />
              </button>
            </Tooltip>
          )}
          <Tooltip content={isOpen ? 'Close issue list' : 'Open issue list'}>
            <button
              type="button"
              tabIndex={-1}
              onClick={togglePanel}
              aria-label={isOpen ? 'Close issue list' : 'Open issue list'}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronDown
                size={ICON_SIZE.row}
                aria-hidden
                className={cn('motion-safe:transition-transform', isOpen && 'rotate-180')}
              />
            </button>
          </Tooltip>
        </div>
      }
    >
      {hasPopupContent ? (
        <>
          {isLoadingState && (
            <div role="status" aria-label="Loading issues" className="py-0.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2 px-2.5 py-1.5">
                  <Skeleton className="h-3 w-12 shrink-0 rounded" />
                  <Skeleton className="h-3 min-w-0 flex-1 rounded" />
                </div>
              ))}
            </div>
          )}

          {isErrorState && !hasOptions && (
            <div className="px-3 py-2 text-xs text-danger">{error}</div>
          )}

          {hasOptions && (
            <ScrollFade className="max-h-72" viewportClassName="py-0.5" fadeFrom="subtle">
              <ul ref={listRef} role="listbox">
                {options.map((row, index) => (
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
                      {pasted == null ? (
                        <>
                          <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                            {row.identifier}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-foreground">
                            {row.title}
                          </span>
                        </>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          Link {row.identifier}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollFade>
          )}

          {isEmptyState && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              <EmptyState
                icon={CONCEPT_ICONS.search}
                tone={CONCEPT_TONE.search}
                title={
                  query.trim() !== '' ? 'No matching issues' : 'No open issues assigned to you'
                }
                size="inline"
                className="p-0"
              />
            </div>
          )}
        </>
      ) : null}
    </AnchoredPopover>
  );
};
