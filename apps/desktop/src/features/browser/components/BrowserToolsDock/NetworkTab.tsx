import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Button,
  EmptyLine,
  ScrollFade,
  SearchField,
  SegmentedTabs,
  cn,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { useHandOutputToAgent } from '../../../../shared/hooks/useHandOutputToAgent';
import { isTextEntryTarget } from '../../../../shared/keyboard/isTypingTarget';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { NAMES } from '../../../../shared/utils/names';
import type { BrowserToolsSide } from '../../browserToolsDockPref';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import { networkRowsOf, type NetworkTypeFilter } from '../../networkRowsOf';
import { networkSummaryOf } from '../../networkSummaryOf';
import { requestAttachmentOf } from '../../requestAttachmentOf';
import type { BrowserConsoleEntry, BrowserPaneModel, BrowserToolsTab } from '../../types';
import { BrowserToolsHead } from './BrowserToolsHead';
import { NetworkDetail } from './NetworkDetail';
import { NetworkTable } from './NetworkTable';
import { useRequestSelection } from './useRequestSelection';

type TabParams = {
  readonly next: BrowserToolsTab;
};

type Props = {
  readonly model: BrowserPaneModel;
  readonly counts: Readonly<Record<BrowserToolsTab, number>>;
  readonly log: ConsoleEntries;
  readonly side: BrowserToolsSide;
  readonly isToolsInHead: boolean;
  readonly onTab: (params: TabParams) => void;
  readonly onSide: () => void;
  readonly onClose: () => void;
};

type EntryParams = {
  readonly entry: BrowserConsoleEntry;
};

type StepParams = {
  readonly direction: -1 | 1;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLDivElement>;
};

const TYPE_FILTERS: ReadonlyArray<SegmentedTabOption<NetworkTypeFilter>> = [
  { value: 'all', label: 'All' },
  { value: 'fetch', label: 'Fetch' },
  { value: 'doc', label: 'Doc' },
  { value: 'js', label: 'JS' },
  { value: 'css', label: 'CSS' },
  { value: 'img', label: 'Img' },
  { value: 'socket', label: 'WS', tooltip: 'WebSocket and event streams' },
];

const FAILURE_TEXT = {
  read: "Couldn't read the console",
  silent: 'Console stopped reporting',
} as const;

const EMPTY_TEXT = 'No request since the last load';

const NO_MATCH_TEXT = 'Nothing matches the filter';

const AGENT_GONE_TEXT = "The agent isn't in this session anymore. Pick one and try again.";

export const NetworkTab = ({
  model,
  counts,
  log,
  side,
  isToolsInHead,
  onTab,
  onSide,
  onClose,
}: Props) => {
  const [type, setType] = useState<NetworkTypeFilter>('all');
  const [isFailedOnly, setIsFailedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const savedScroll = useRef<number | null>(null);
  const target = useHandOutputToAgent({ sessionId: model.sessionId });
  const agentName = target.agentName ?? 'the agent';
  const all = networkRowsOf({ entries: log.entries, type: 'all', isFailedOnly: false, query: '' });
  const rows = networkRowsOf({ entries: log.entries, type, isFailedOnly, query });
  const isFiltered = type !== 'all' || isFailedOnly || query.trim() !== '';
  const { openedAt, open, back } = useRequestSelection({
    rows,
    liveId: model.shownLiveId,
    doc: log.doc,
    list,
  });
  const opened = openedAt < 0 ? null : (rows[openedAt] ?? null);
  const isDetailAlone = opened !== null && side === 'right';

  useLayoutEffect(() => {
    const node = viewport.current;
    const top = savedScroll.current;
    if (isDetailAlone || node === null || top === null) {
      return;
    }
    savedScroll.current = null;
    node.scrollTop = top;
  }, [isDetailAlone]);

  const openRow = ({ entry }: EntryParams): void => {
    if (side === 'right') {
      savedScroll.current = viewport.current?.scrollTop ?? null;
    }
    open({ entry });
  };

  const step = ({ direction }: StepParams): void => {
    const next = rows[openedAt + direction];
    if (next === undefined) {
      return;
    }
    open({ entry: next });
  };

  const keys = ({ event }: KeyParams): void => {
    if (opened === null || event.defaultPrevented || isTextEntryTarget(event.target)) {
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      step({ direction: event.key === 'ArrowUp' ? -1 : 1 });
    }
  };

  const send = ({ entry }: EntryParams): void => {
    const { agentId } = target;
    if (agentId === null) {
      setNote(AGENT_GONE_TEXT);
      return;
    }
    const handoff = requestAttachmentOf({ entry, pageUrl: model.address });
    const isQueued = target.queue({ agentId, handoff });
    setNote(
      isQueued
        ? `Added to your message to ${agentName} as ${handoff.fileName}. Nothing goes until you send.`
        : AGENT_GONE_TEXT,
    );
  };

  const clear = (): void => {
    log.clear({ kind: 'network' });
    setNote(null);
  };

  const tools = (
    <>
      <Button
        variant="quiet"
        size="xs"
        aria-pressed={isFailedOnly}
        onClick={() => setIsFailedOnly(!isFailedOnly)}
        className={cn('shrink-0', isFailedOnly && 'bg-fill text-foreground')}
      >
        Failed only
      </Button>
      <SearchField
        ariaLabel={NAMES.searchRequests}
        placeholder={NAMES.searchRequests}
        value={query}
        onChange={setQuery}
        className={cn('flex-1', isToolsInHead ? 'min-w-0 max-w-56' : 'min-w-32')}
      />
      <Button variant="quiet" size="xs" disabled={counts.network === 0} onClick={clear}>
        Clear
      </Button>
    </>
  );

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 pb-1"
      onKeyDown={(event) => keys({ event })}
    >
      <BrowserToolsHead
        kind="network"
        counts={counts}
        side={side}
        tools={isToolsInHead ? tools : null}
        onKind={onTab}
        onSide={onSide}
        onClose={onClose}
      />
      {isToolsInHead || isDetailAlone ? null : (
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-2">{tools}</div>
      )}
      {log.failure === null ? null : (
        <p role="status" className="shrink-0 px-3 text-meta text-danger">
          {FAILURE_TEXT[log.failure]}
        </p>
      )}
      {note === null ? null : (
        <p role="status" className="shrink-0 px-3 text-meta text-muted-foreground">
          {note}
        </p>
      )}
      <div className="flex min-h-0 min-w-0 flex-1">
        {isDetailAlone ? null : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
            <div className="flex shrink-0 px-2">
              <SegmentedTabs
                size="xs"
                ariaLabel="Request type"
                value={type}
                onChange={setType}
                options={TYPE_FILTERS}
              />
            </div>
            <ScrollFade
              className="min-h-0 min-w-0 flex-1"
              viewportRef={viewport}
              isPageScroller={false}
            >
              <div ref={list} tabIndex={-1} className="flex min-w-0 flex-col outline-none">
                {rows.length === 0 ? (
                  <EmptyLine className="px-2">
                    {isFiltered && all.length > 0 ? NO_MATCH_TEXT : EMPTY_TEXT}
                  </EmptyLine>
                ) : (
                  <NetworkTable
                    rows={rows}
                    opened={opened}
                    isNarrow={opened !== null || side === 'right'}
                    onOpen={openRow}
                  />
                )}
              </div>
            </ScrollFade>
          </div>
        )}
        {opened === null ? null : (
          <NetworkDetail
            entry={opened}
            pageUrl={model.address}
            isAlone={isDetailAlone}
            canStepBack={openedAt > 0}
            canStepOn={openedAt < rows.length - 1}
            agentName={agentName}
            canSend={target.canHandOff}
            onBack={back}
            onStep={step}
            onSend={() => send({ entry: opened })}
          />
        )}
      </div>
      <p className="shrink-0 px-3 text-meta text-faint-foreground">
        {joinFacts({ facts: networkSummaryOf({ rows, all }) })}
      </p>
    </div>
  );
};
