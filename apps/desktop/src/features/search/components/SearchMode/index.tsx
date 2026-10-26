import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SearchHit, WorkspaceId } from '@goodboy/types';
import { ScrollFade, EmptyState } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { useWorkspaceIssueLookup } from '../../../integrations/hooks/useWorkspaceIssueLookup';
import { lookupStatuses } from '../../../integrations/issueCode/lookupCopy';
import { openToolSettings } from '../../../integrations/openToolSettings';
import { LookupStatusRow } from '../../../inbox/components/InboxStudio/LookupStatusRow';
import { extractQualifiers } from '../../grammar';
import { toSearchQuery } from '../../toSearchQuery';
import { widenScope, type SearchScope } from '../../searchScope';
import type { SearchChip } from '../../searchChips';
import { searchHitTarget } from '../../searchHitTarget';
import { openSearchHit } from '../../openSearchHit';
import { useSearchResults } from '../../hooks/useSearchResults';
import { useSearchContext } from '../../hooks/useSearchContext';
import type { PaletteModeProps } from '../../../palette/paletteModeTypes';
import { PaletteInputRow } from '../../../palette/components/PaletteOverlay/PaletteInputRow';
import { SearchChips } from './SearchChips';
import { SearchFilterBar, filterGroupOf, type GroupChangeParams } from './SearchFilterBar';
import { SearchResultRow } from './SearchResultRow';
import { SearchPreview } from './SearchPreview';
import { SearchFooter } from './SearchFooter';
import { LookupHitRow } from './LookupHitRow';
import { searchProgressLabel } from './searchProgressLabel';
import { useListboxCursor } from '../../../../shared/hooks/useListboxCursor';

type Item =
  | { readonly kind: 'lookup'; readonly id: string; readonly url: string }
  | { readonly kind: 'result'; readonly id: string; readonly hit: SearchHit };

type OpenItemParams = {
  readonly item: Item;
};

const RECENT_KINDS = ['session', 'plan', 'report', 'decision', 'question', 'issue', 'pr'] as const;

export const SearchMode = ({
  query: text,
  onQueryChange,
  scope: paletteScope,
  onClearScope,
  onSwitchMode,
  onClose,
  modeSwitch,
}: PaletteModeProps) => {
  const context = useSearchContext({ paletteScope });
  const status = useAppStore((state) => state.searchIndexStatus);
  const loadStatus = useAppStore((state) => state.loadSearchIndexStatus);
  const reportError = useAppStore((state) => state.reportError);
  const [scope, setScope] = useState<SearchScope>(context.initialScope);
  const [now] = useState(() => Date.now());
  const [initial] = useState(() =>
    extractQualifiers({ text, projects: context.projects, now, isFinal: true }),
  );
  const [chips, setChips] = useState<ReadonlyArray<SearchChip>>(initial.chips);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    void loadStatus().catch(() => undefined);
    if (initial.chips.length > 0) {
      onQueryChange(initial.text);
    }
  }, []);

  const isEmptyQuery = text.trim().length === 0 && chips.length === 0;
  const query = useMemo(() => {
    const base = toSearchQuery({ text, scope, chips });
    return isEmptyQuery ? { ...base, kinds: [...RECENT_KINDS] } : base;
  }, [text, scope, chips, isEmptyQuery]);
  const results = useSearchResults({ query });

  const workspaceId = scope.kind === 'all' ? null : scope.workspaceId;
  const lookup = useWorkspaceIssueLookup({
    workspaceId: workspaceId ?? ('' as WorkspaceId),
    query: text.trim(),
    isKnown: (code) =>
      results.hits.some((hit) => hit.kind === 'issue' && hit.container?.toUpperCase() === code),
  });
  const lookupHits = lookup.state.status === 'done' ? lookup.state.value.result.hits : [];
  const statuses =
    lookup.state.status === 'done'
      ? lookupStatuses({ lookup: lookup.state.value, workspaceName: context.workspaceLabel ?? '' })
      : [];

  const items = useMemo((): ReadonlyArray<Item> => {
    const fromLookup = lookupHits.map((hit): Item => ({
      kind: 'lookup',
      id: `lookup:${hit.record.key}`,
      url: hit.record.url,
    }));
    const fromIndex = results.hits.map((hit): Item => ({ kind: 'result', id: hit.docId, hit }));
    return [...fromLookup, ...fromIndex];
  }, [lookupHits, results.hits]);

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const cursor = useListboxCursor({ ids: itemIds, listRef, listboxId });
  const { optionId, select: selectItem } = cursor;
  const selected = items[cursor.selectedIndex] ?? null;
  const selectedHit = selected?.kind === 'result' ? selected.hit : null;
  const selectedTarget = selectedHit === null ? null : searchHitTarget({ hit: selectedHit });

  useEffect(() => {
    selectItem({ id: null });
  }, [query, selectItem]);

  const openItem = useCallback(
    ({ item }: OpenItemParams) => {
      if (item.kind === 'lookup') {
        void openUrl(item.url).catch((error: unknown) =>
          reportError({ title: "Couldn't open this issue", error }),
        );
        onClose();
        return;
      }
      if (searchHitTarget({ hit: item.hit }).kind === 'blocked') {
        return;
      }
      onClose();
      void openSearchHit({ hit: item.hit, query: text }).catch((error: unknown) =>
        reportError({ title: "Couldn't open this result", error }),
      );
    },
    [onClose, reportError, text],
  );

  const openById = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item !== undefined) {
        openItem({ item });
      }
    },
    [items, openItem],
  );

  const changeText = (next: string) => {
    const extracted = extractQualifiers({
      text: next,
      projects: context.projects,
      now,
      isFinal: false,
    });
    if (extracted.chips.length > 0) {
      setChips((previous) => [...previous, ...extracted.chips]);
    }
    onQueryChange(extracted.text);
  };

  const widen = () => {
    const next = widenScope({ scope, workspaceLabel: context.workspaceLabel });
    setScope(next);
    if (next.kind === 'all') {
      onClearScope();
    }
  };

  const removeChip = (index: number) => {
    setChips((previous) => previous.filter((_, candidate) => candidate !== index));
  };

  const changeGroup = ({ group, chips: next }: GroupChangeParams) => {
    setChips((previous) => [
      ...previous.filter((chip) => filterGroupOf({ chip }) !== group),
      ...next,
    ]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      cursor.move({ delta: event.key === 'ArrowDown' ? 1 : -1 });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (selected !== null) {
        openItem({ item: selected });
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      onSwitchMode();
      return;
    }
    const isAtEnd = event.currentTarget.selectionStart === text.length;
    if (event.key === 'ArrowRight' && isAtEnd && text.length > 0) {
      const action = document.querySelector<HTMLElement>('[data-search-actions] [role="menuitem"]');
      if (action !== null) {
        event.preventDefault();
        action.focus();
      }
      return;
    }
    if (event.key === 'Backspace' && text.length === 0) {
      event.preventDefault();
      if (chips.length > 0) {
        removeChip(chips.length - 1);
        return;
      }
      widen();
    }
  };

  const progress = searchProgressLabel({ status });
  const scopeName = scope.kind === 'all' ? 'anywhere' : `in ${scope.label}`;
  const showEmpty = !results.isLoading && items.length === 0 && statuses.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaletteInputRow
        inputRef={inputRef}
        value={text}
        placeholder={
          scope.kind === 'all' ? 'Search everything' : 'Search, or type type: in: from: is:'
        }
        ariaLabel="Search"
        listboxId={listboxId}
        activeDescendant={selected === null ? undefined : optionId({ id: selected.id })}
        chip={<SearchChips scope={scope} chips={chips} onWiden={widen} onRemoveChip={removeChip} />}
        modeSwitch={modeSwitch}
        onChange={changeText}
        onKeyDown={handleKeyDown}
      />
      <SearchFilterBar
        chips={chips}
        projects={context.projects}
        now={now}
        onGroupChange={changeGroup}
      />
      <div className="flex min-h-0 flex-1">
        <ScrollFade className="max-h-[320px] min-h-0 min-w-0 flex-1">
          {statuses.map((lookupStatus) => (
            <LookupStatusRow
              key={lookupStatus.key}
              status={lookupStatus}
              retryAt={lookupStatus.key.endsWith(':rate-limited') ? lookup.retryAt : null}
              onAction={(chosen) => {
                if (chosen.action?.kind === 'retry') {
                  lookup.retry();
                  return;
                }
                if (chosen.action?.kind === 'open-integrations') {
                  openToolSettings({ tool: chosen.action.provider });
                }
              }}
            />
          ))}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={isEmptyQuery ? `Recent ${scopeName}` : 'Search results'}
            className="flex flex-col p-1"
          >
            {lookupHits.map((hit) => {
              const id = `lookup:${hit.record.key}`;
              return (
                <LookupHitRow
                  key={id}
                  record={hit.record}
                  optionId={optionId({ id })}
                  isSelected={selected?.id === id}
                  onHover={() => selectItem({ id })}
                  onOpen={() => openById(id)}
                />
              );
            })}
            {results.hits.map((hit) => (
              <SearchResultRow
                key={hit.docId}
                hit={hit}
                optionId={optionId({ id: hit.docId })}
                isSelected={selected?.id === hit.docId}
                isBlocked={searchHitTarget({ hit }).kind === 'blocked'}
                isSessionScoped={scope.kind === 'session'}
                onHover={(id) => selectItem({ id })}
                onOpen={openById}
              />
            ))}
          </ul>
          {showEmpty ? (
            <EmptyState
              size="section"
              icon={CONCEPT_ICONS.search}
              tone={CONCEPT_TONE.search}
              title={
                isEmptyQuery
                  ? `Nothing indexed ${scopeName} yet`
                  : `Nothing matches “${text.trim()}” ${scopeName}`
              }
              description={
                results.hasFailed
                  ? 'Search could not read its index. Try again, or rebuild it in Settings.'
                  : undefined
              }
              className="justify-center"
            />
          ) : null}
          {showEmpty && scope.kind !== 'all' ? (
            <div className="flex justify-center pb-4">
              <button
                type="button"
                onClick={() => setScope({ kind: 'all' })}
                className="rounded-md px-2 py-1 text-meta text-foreground hover:bg-hover"
              >
                Search everywhere
              </button>
            </div>
          ) : null}
        </ScrollFade>
        {selectedHit === null || selectedTarget === null ? null : (
          <SearchPreview
            hit={selectedHit}
            target={selectedTarget}
            onOpen={() => openById(selectedHit.docId)}
            onDone={onClose}
          />
        )}
      </div>
      <SearchFooter progress={progress} />
    </div>
  );
};
