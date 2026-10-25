import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { TriangleAlert, Search } from 'lucide-react';
import {
  cn,
  Divider,
  EmptyLine,
  Eyebrow,
  ICON_SIZE,
  Kbd,
  ScrollFade,
  SegmentedTabs,
  SkeletonRow,
} from '@goodboy/ui';
import type { SessionExternalTaskProvider } from '@goodboy/types';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import type { LaunchExternalTask } from '../../../inbox/launchSpecFor';

import { useNow } from '../../../../shared/hooks/useNow';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { LinkScopePreview } from './LinkScopePreview';
import { LINKED_LABEL, relationFor, type LinkChoice } from './linkScope';
import { starIdentityOfTask, starKey } from '../../../integrations/starred/starredIssueOf';
import {
  LINK_WORK_PROVIDER_LABEL,
  linkWorkView,
  type LinkedKeys,
  type LinkWorkItem,
  type LinkWorkRow,
  type LinkWorkSource,
} from './linkWorkRows';

type Props = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly items: ReadonlyArray<LinkWorkItem>;
  readonly lookedUp: ReadonlyArray<LinkWorkItem>;
  readonly linkedKeys: LinkedKeys;
  readonly starredKeys: ReadonlySet<string>;
  readonly sources: ReadonlyArray<SessionExternalTaskProvider>;
  readonly initialSource?: SessionExternalTaskProvider;
  readonly isLoading: boolean;
  readonly isLinking: boolean;
  readonly error: string | null;
  readonly onLink: (task: LaunchExternalTask, choice: LinkChoice) => void;
  readonly onStar: (task: LaunchExternalTask) => void;
  readonly onClose: () => void;
};

const SECTION_TITLE: Readonly<Record<LinkWorkRow['section'], string>> = {
  inbox: 'From Tasks',
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
  if (row.isLinked) {
    return LINKED_LABEL;
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
  linkedKeys,
  starredKeys,
  sources,
  initialSource,
  isLoading,
  isLinking,
  error,
  onLink,
  onStar,
  onClose,
}: Props) => {
  const now = useNow(30_000);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedSource, setSource] = useState<LinkWorkSource | null>(null);
  const source: LinkWorkSource =
    pickedSource ??
    (initialSource !== undefined && sources.includes(initialSource) ? initialSource : 'all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isClosing, setIsClosing] = useState(true);
  const view = useMemo(
    () => linkWorkView({ query, source, items, lookedUp, linkedKeys }),
    [query, source, items, lookedUp, linkedKeys],
  );
  const rows = view.kind === 'unknownLink' ? [] : view.rows;
  const active = rows[Math.min(activeIndex, rows.length - 1)] ?? null;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, source]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isStarred = (row: LinkWorkRow): boolean => {
    const identity = starIdentityOfTask({ task: row.task });
    return identity !== null && starredKeys.has(starKey(identity));
  };

  const optionId = (key: string): string => `${listId}-${key}`;

  const link = (row: LinkWorkRow | null): void => {
    if (row === null || isLinking || row.isLinked) {
      return;
    }
    onLink(row.task, { relation: relationFor({ isClosing }) });
  };

  const star = (row: LinkWorkRow | null): void => {
    if (row === null || isLinking) {
      return;
    }
    onStar(row.task);
  };

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
      <div className="flex items-center gap-2 px-3 py-3">
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
          <p className="px-3 py-3 text-meta text-muted-foreground">
            {`Goodboy links ${Object.values(LINK_WORK_PROVIDER_LABEL).join(', ')} URLs.`}
          </p>
        ) : rows.length === 0 && isLoading ? (
          <SkeletonRow label="Loading your tasks" />
        ) : rows.length === 0 && query.trim() === '' ? (
          <EmptyLine className="justify-center px-3 py-5 text-center">
            Paste a link or search
          </EmptyLine>
        ) : rows.length === 0 ? (
          <p className="flex flex-col items-center gap-0.5 px-3 py-5 text-center text-meta text-muted-foreground">
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
                      className="flex h-7 items-end px-3"
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
                  'flex h-9 cursor-pointer items-center gap-3 rounded-sm px-3 text-body',
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
                <span className="shrink-0 text-meta text-faint-foreground">
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
          isClosing={isClosing}
          isLinking={isLinking}
          isDuplicate={active.isLinked}
          canStar={starIdentityOfTask({ task: active.task }) !== null}
          isStarred={isStarred(active)}
          onStar={() => star(active)}
          onToggleClosing={() => setIsClosing((current) => !current)}
          onLink={() => link(active)}
          onCancel={onClose}
        />
      )}
      {error !== null ? (
        <p role="alert" className="flex items-center gap-1 px-3 py-2 text-meta text-danger">
          <TriangleAlert size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          {error}
        </p>
      ) : null}
      <Divider />
      <div className="flex items-center gap-4 bg-muted px-3 py-2 text-meta text-faint-foreground">
        <span className="flex items-center gap-2">
          <Kbd look="cap">↑↓</Kbd>
          move
        </span>
        <span className="flex items-center gap-2">
          <Kbd look="cap">Enter</Kbd>
          link
        </span>
        <span className="flex items-center gap-2">
          <Kbd look="cap">Esc</Kbd>
          close
        </span>
      </div>
    </div>
  );
};
