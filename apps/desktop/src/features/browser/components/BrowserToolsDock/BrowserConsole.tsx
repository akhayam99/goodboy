import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button, EmptyLine, ScrollFade, SearchField, cn } from '@goodboy/ui';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { isTextEntryTarget } from '../../../../shared/keyboard/isTypingTarget';
import type { BrowserToolsSide } from '../../browserToolsDockPref';
import { consoleAttachmentOf } from '../../consoleAttachmentOf';
import { consoleCounts } from '../../consoleCounts';
import { consoleRowsOf, type ConsoleLevelFilter } from '../../consoleRowsOf';
import { queueConsoleHandoff } from '../../queueConsoleHandoff';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import type { BrowserConsoleKind, BrowserPaneModel } from '../../types';
import { BrowserConsoleLevelMenu } from './BrowserConsoleLevelMenu';
import { BrowserConsoleRow } from './BrowserConsoleRow';
import { BrowserConsoleSendMenu } from './BrowserConsoleSendMenu';
import { BrowserRequestDetail } from './BrowserRequestDetail';
import { BrowserToolsHead } from './BrowserToolsHead';
import { requestKeyOf } from './requestKeyOf';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly model: BrowserPaneModel;
  readonly title: string;
  readonly log: ConsoleEntries;
  readonly side: BrowserToolsSide;
  readonly isToolsInHead: boolean;
  readonly onSide: () => void;
  readonly onClose: () => void;
};

type KindParams = {
  readonly next: BrowserConsoleKind;
};

type LevelParams = {
  readonly next: ConsoleLevelFilter;
};

type SendParams = {
  readonly sessionId: SessionId;
};

type StepParams = {
  readonly direction: -1 | 1;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLDivElement>;
};

const FOLLOW_SLACK_PX = 24;

const SEARCH_LABEL = {
  console: NAMES.searchMessages,
  network: NAMES.searchRequests,
} as const satisfies Record<BrowserConsoleKind, string>;

const FAILURE_TEXT = {
  read: "Couldn't read the console",
  silent: 'Console stopped reporting',
} as const;

const EMPTY_TEXT = {
  console: 'Nothing logged since the last load',
  network: 'No request since the last load',
} as const satisfies Record<BrowserConsoleKind, string>;

const NO_MATCH_TEXT = 'Nothing matches the filter';

const AGENT_GONE_TEXT = "The agent isn't in this session anymore. Pick one and try again.";

export const BrowserConsole = ({
  model,
  title,
  log,
  side,
  isToolsInHead,
  onSide,
  onClose,
}: Props) => {
  const [kind, setKind] = useState<BrowserConsoleKind>('console');
  const [level, setLevel] = useState<ConsoleLevelFilter>('all');
  const [query, setQuery] = useState('');
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const isFollowing = useRef(true);
  const openSession = useOpenSession();
  const counts = consoleCounts({ entries: log.entries });
  const rows = consoleRowsOf({ entries: log.entries, kind, level, query });
  const isFiltered = level !== 'all' || query.trim() !== '';
  const openedAt =
    kind === 'network' && openedKey !== null
      ? rows.findIndex((entry) => requestKeyOf({ entry }) === openedKey)
      : -1;
  const opened = openedAt < 0 ? null : (rows[openedAt] ?? null);
  const isDetailAlone = opened !== null && side === 'right';

  useLayoutEffect(() => {
    const node = viewport.current;
    if (node !== null && isFollowing.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [rows.length, kind, isDetailAlone]);

  const follow = (): void => {
    const node = viewport.current;
    if (node !== null) {
      isFollowing.current =
        node.scrollHeight - node.scrollTop - node.clientHeight < FOLLOW_SLACK_PX;
    }
  };

  const changeKind = ({ next }: KindParams): void => {
    setKind(next);
    setLevel('all');
    setOpenedKey(null);
  };

  const changeLevel = ({ next }: LevelParams): void => setLevel(next);

  const send = ({ sessionId }: SendParams): void => {
    const handoff = consoleAttachmentOf({ entries: log.entries, title, url: model.address });
    const isQueued = queueConsoleHandoff({ sessionId, handoff });
    if (isQueued && sessionId !== model.sessionId) {
      openSession({ sessionId });
    }
    setSendNote(
      isQueued
        ? `Sent as ${handoff.fileName}, a chip in the composer. Nothing goes until you send.`
        : AGENT_GONE_TEXT,
    );
  };

  const clear = (): void => {
    log.clear({ kind });
    setSendNote(null);
  };

  const step = ({ direction }: StepParams): void => {
    const next = rows[openedAt + direction];
    if (next === undefined) {
      return;
    }
    setOpenedKey(requestKeyOf({ entry: next }));
  };

  const keys = ({ event }: KeyParams): void => {
    if (opened === null || event.defaultPrevented) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpenedKey(null);
      return;
    }
    if (isTextEntryTarget(event.target)) {
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      step({ direction: event.key === 'ArrowUp' ? -1 : 1 });
    }
  };

  const tools = (
    <>
      <BrowserConsoleLevelMenu kind={kind} level={level} onChange={changeLevel} />
      <SearchField
        ariaLabel={SEARCH_LABEL[kind]}
        placeholder={SEARCH_LABEL[kind]}
        value={query}
        onChange={setQuery}
        className={cn('min-w-0 flex-1', isToolsInHead && 'max-w-56')}
      />
      <Button variant="quiet" size="xs" disabled={counts[kind] === 0} onClick={clear}>
        Clear
      </Button>
      <BrowserConsoleSendMenu
        sessionId={model.sessionId}
        isDisabled={log.entries.length === 0}
        onSend={send}
      />
    </>
  );

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 pb-1"
      onKeyDown={(event) => keys({ event })}
    >
      <BrowserToolsHead
        kind={kind}
        counts={counts}
        side={side}
        tools={isToolsInHead ? tools : null}
        onKind={changeKind}
        onSide={onSide}
        onClose={onClose}
      />
      {isToolsInHead || isDetailAlone ? null : (
        <div className="flex shrink-0 items-center gap-2 px-2">{tools}</div>
      )}
      {log.failure === null ? null : (
        <p role="status" className="shrink-0 px-3 text-meta text-danger">
          {FAILURE_TEXT[log.failure]}
        </p>
      )}
      {sendNote === null ? null : (
        <p role="status" className="shrink-0 px-3 text-meta text-muted-foreground">
          {sendNote}
        </p>
      )}
      <div className="flex min-h-0 min-w-0 flex-1">
        {isDetailAlone ? null : (
          <ScrollFade
            className="min-h-0 min-w-0 flex-1"
            viewportRef={viewport}
            onViewportScroll={follow}
            isPageScroller={false}
          >
            <div
              role="log"
              aria-label={kind === 'console' ? 'Console messages' : 'Requests'}
              className="flex flex-col gap-px px-1"
            >
              {rows.length === 0 ? (
                <EmptyLine className="px-2">
                  {isFiltered && counts[kind] > 0 ? NO_MATCH_TEXT : EMPTY_TEXT[kind]}
                </EmptyLine>
              ) : (
                rows.map((entry) => (
                  <BrowserConsoleRow
                    key={entry.seq}
                    entry={entry}
                    isOpened={entry === opened}
                    onOpen={
                      kind === 'network' ? () => setOpenedKey(requestKeyOf({ entry })) : undefined
                    }
                  />
                ))
              )}
            </div>
          </ScrollFade>
        )}
        {opened === null ? null : (
          <BrowserRequestDetail
            entry={opened}
            isAlone={isDetailAlone}
            canStepBack={openedAt > 0}
            canStepOn={openedAt < rows.length - 1}
            onBack={() => setOpenedKey(null)}
            onStep={step}
          />
        )}
      </div>
    </div>
  );
};
