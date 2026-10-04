import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { Divider, Eyebrow, KbdPill, ScrollFade, SegmentedTabs, SkeletonRow, cn } from '@goodboy/ui';
import type { SessionExternalTaskProvider } from '@goodboy/types';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { LaunchExternalTask } from '../../../inbox/launchSpecFor';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { LinkScopePreview } from './LinkScopePreview';
import {
  SCOPE_TAB_LABEL,
  linkedLabel,
  relationFor,
  type LinkChoice,
  type LinkScope,
} from './linkScope';
import {
  LINK_WORK_PROVIDER_LABEL,
  linkWorkView,
  type LinkedScopes,
  type LinkWorkItem,
  type LinkWorkRow,
  type LinkWorkSource,
} from './linkWorkRows';

type Props = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly items: ReadonlyArray<LinkWorkItem>;
  readonly lookedUp: ReadonlyArray<LinkWorkItem>;
  readonly linkedScopes: LinkedScopes;
  readonly sources: ReadonlyArray<SessionExternalTaskProvider>;
  readonly isLoading: boolean;
  readonly isLinking: boolean;
  readonly error: string | null;
  readonly onLink: (task: LaunchExternalTask, choice: LinkChoice) => void;
  readonly onClose: () => void;
};

const SECTION_TITLE: Readonly<Record<LinkWorkRow['section'], string>> = {
  inbox: 'From your inbox',
  results: 'Results',
  paste: 'Paste',
};

const LIST_FORMAT = new Intl.ListFormat('en', { type: 'disjunction' });

const ALL_TRACKERS = LIST_FORMAT.format(Object.values(LINK_WORK_PROVIDER_LABEL));

const placeholderOf = ({
  sources,
}: {
  readonly sources: ReadonlyArray<SessionExternalTaskProvider>;
}): string =>
  sources.length === 0
    ? 'Paste a link to an issue'
    : `Search ${LIST_FORMAT.format(sources.map((source) => LINK_WORK_PROVIDER_LABEL[source]))} or paste a link`;

const rowMeta = ({ row, now }: { readonly row: LinkWorkRow; readonly now: number }): string => {
  if (row.linkedScopes.length > 0) {
    return linkedLabel({ scopes: row.linkedScopes });
  }
  if (row.section === 'inbox') {
    return formatSpan({ from: row.updatedAt, to: now });
  }
  if (row.section === 'paste') {
    return 'Link this URL';
  }
  return row.status;
};

export const LinkWorkPicker = ({
  query,
  onQueryChange,
  items,
  lookedUp,
  linkedScopes,
  sources,
  isLoading,
  isLinking,
  error,
  onLink,
  onClose,
}: Props) => {
  const now = useNow(30_000);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<LinkWorkSource>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [scope, setScope] = useState<LinkScope>('session');
  const [isClosing, setIsClosing] = useState(true);
  const view = useMemo(
    () => linkWorkView({ query, source, items, lookedUp, linkedScopes }),
    [query, source, items, lookedUp, linkedScopes],
  );
  const rows = view.kind === 'unknownLink' ? [] : view.rows;
  const active = rows[Math.min(activeIndex, rows.length - 1)] ?? null;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, source]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const optionId = (key: string): string => `${listId}-${key}`;

  const isDuplicate = (row: LinkWorkRow): boolean => row.linkedScopes.includes(scope);

  const link = (row: LinkWorkRow | null): void => {
    if (row === null || isLinking || isDuplicate(row)) {
      return;
    }
    onLink(row.task, { scope, relation: relationFor({ scope, isClosing }) });
  };

  const pickScope = (next: LinkScope): void => {
    setScope(next);
    setIsClosing(true);
  };

  const scopeOptions = [
    { value: 'session' as const, label: SCOPE_TAB_LABEL.session },
    { value: 'workspace' as const, label: SCOPE_TAB_LABEL.workspace },
  ];

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => (rows.length === 0 ? 0 : (index + 1) % rows.length));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) =>
          rows.length === 0 ? 0 : (index - 1 + rows.length) % rows.length,
        );
        return;
      case 'Enter':
        event.preventDefault();
        link(active);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      default:
        return;
    }
  };

  const sourceOptions = [
    { value: 'all', label: 'All' },
    ...sources.map((provider) => ({
      value: provider,
      label: LINK_WORK_PROVIDER_LABEL[provider],
      glyph: <IntegrationGlyph provider={provider} size="xs" />,
    })),
  ];
  const sourceName = source === 'all' ? ALL_TRACKERS : LINK_WORK_PROVIDER_LABEL[source];

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Search size={ICON_SIZE.control} aria-hidden className="shrink-0 text-faint-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          role="combobox"
          aria-label="Search work to link"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={active === null ? undefined : optionId(active.key)}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          disabled={isLinking}
          placeholder={placeholderOf({ sources })}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-faint-foreground"
        />
      </div>
      <div className="flex px-2 pb-2">
        <SegmentedTabs
          size="sm"
          ariaLabel="Link scope"
          options={scopeOptions}
          value={scope}
          onChange={pickScope}
        />
      </div>
      {sources.length > 1 && view.kind === 'list' ? (
        <div className="flex px-2 pb-2">
          <SegmentedTabs
            size="sm"
            ariaLabel="Filter by source"
            options={sourceOptions}
            value={source}
            onChange={(next) =>
              setSource(
                next === 'all' ? 'all' : (sources.find((candidate) => candidate === next) ?? 'all'),
              )
            }
          />
        </div>
      ) : null}
      <Divider />
      <ScrollFade className="max-h-80" viewportClassName="p-1" fadeFrom="floating">
        {view.kind === 'unknownLink' ? (
          <p className="px-2.5 py-3 text-label text-muted-foreground">
            {`Goodboy links ${Object.values(LINK_WORK_PROVIDER_LABEL).join(', ')} URLs.`}
          </p>
        ) : rows.length === 0 && isLoading ? (
          <SkeletonRow label="Loading your inbox" />
        ) : rows.length === 0 ? (
          <p className="flex flex-col items-center gap-0.5 px-2.5 py-5 text-center text-label text-muted-foreground">
            <span>{`Nothing in ${sourceName} matches.`}</span>
            <span className="text-faint-foreground">Paste a link to attach anything else.</span>
          </p>
        ) : (
          <ul id={listId} role="listbox" aria-label="Work to link" className="flex flex-col">
            {rows.flatMap((row, index) => [
              ...(index === 0 || rows[index - 1]?.section !== row.section
                ? [
                    <li
                      key={`section:${row.section}`}
                      role="presentation"
                      className="flex h-7 items-end px-2.5"
                    >
                      <Eyebrow label={SECTION_TITLE[row.section]} />
                    </li>,
                  ]
                : []),
              <li
                key={row.key}
                id={optionId(row.key)}
                role="option"
                aria-selected={row.key === active?.key}
                aria-label={
                  row.section === 'paste'
                    ? `Link ${row.task.identifier}`
                    : `${row.task.title} (${row.task.identifier})`
                }
                className={cn(
                  'flex h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-body',
                  row.key === active?.key ? 'bg-selected' : 'hover:bg-hover',
                )}
                onMouseMove={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setActiveIndex(index);
                  link(row);
                }}
              >
                <IntegrationGlyph provider={row.task.provider} size="xs" />
                <span className="w-32 shrink-0 truncate text-code text-muted-foreground">
                  {row.task.identifier}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{row.task.title}</span>
                <span className="shrink-0 text-label text-faint-foreground">
                  {rowMeta({ row, now })}
                </span>
              </li>,
            ])}
          </ul>
        )}
      </ScrollFade>
      {active === null ? null : (
        <LinkScopePreview
          provider={active.task.provider}
          identifier={active.task.identifier}
          title={active.task.title}
          scope={scope}
          isClosing={isClosing}
          isLinking={isLinking}
          {...(isDuplicate(active) ? { duplicate: { scopes: active.linkedScopes } } : {})}
          onToggleClosing={() => setIsClosing((current) => !current)}
          onLink={() => link(active)}
          onCancel={onClose}
        />
      )}
      {error !== null ? (
        <p role="alert" className="flex items-center gap-1 px-3 py-2 text-label text-danger">
          <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          {error}
        </p>
      ) : null}
      <Divider />
      <div className="flex items-center gap-4 bg-muted px-3 py-2 text-label text-faint-foreground">
        <span className="flex items-center gap-1.5">
          <KbdPill>↑↓</KbdPill>
          move
        </span>
        <span className="flex items-center gap-1.5">
          <KbdPill>Enter</KbdPill>
          link
        </span>
        <span className="flex items-center gap-1.5">
          <KbdPill>Esc</KbdPill>
          close
        </span>
      </div>
    </div>
  );
};
