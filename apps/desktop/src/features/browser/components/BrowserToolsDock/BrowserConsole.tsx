import { useLayoutEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button, EmptyLine, ScrollFade, SearchField, cn } from '@goodboy/ui';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import type { BrowserToolsSide } from '../../browserToolsDockPref';
import { consoleAttachmentOf } from '../../consoleAttachmentOf';
import { consoleRowsOf, type ConsoleLevelFilter } from '../../consoleRowsOf';
import { queueConsoleHandoff } from '../../queueConsoleHandoff';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import type { BrowserPaneModel, BrowserToolsTab } from '../../types';
import { BrowserConsoleLevelMenu } from './BrowserConsoleLevelMenu';
import { BrowserConsoleRow } from './BrowserConsoleRow';
import { BrowserConsoleSendMenu } from './BrowserConsoleSendMenu';
import { BrowserToolsHead } from './BrowserToolsHead';
import { NAMES } from '../../../../shared/utils/names';

type TabParams = {
  readonly next: BrowserToolsTab;
};

type Props = {
  readonly model: BrowserPaneModel;
  readonly counts: Readonly<Record<BrowserToolsTab, number>>;
  readonly title: string;
  readonly log: ConsoleEntries;
  readonly side: BrowserToolsSide;
  readonly isToolsInHead: boolean;
  readonly onTab: (params: TabParams) => void;
  readonly onSide: () => void;
  readonly onClose: () => void;
};

type LevelParams = {
  readonly next: ConsoleLevelFilter;
};

type SendParams = {
  readonly sessionId: SessionId;
};

const FOLLOW_SLACK_PX = 24;

const FAILURE_TEXT = {
  read: "Couldn't read the console",
  silent: 'Console stopped reporting',
} as const;

const EMPTY_TEXT = 'Nothing logged since the last load';

const NO_MATCH_TEXT = 'Nothing matches the filter';

const AGENT_GONE_TEXT = "The agent isn't in this session anymore. Pick one and try again.";

export const BrowserConsole = ({
  model,
  counts,
  title,
  log,
  side,
  isToolsInHead,
  onTab,
  onSide,
  onClose,
}: Props) => {
  const [level, setLevel] = useState<ConsoleLevelFilter>('all');
  const [query, setQuery] = useState('');
  const [sendNote, setSendNote] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const isFollowing = useRef(true);
  const openSession = useOpenSession();
  const rows = consoleRowsOf({ entries: log.entries, kind: 'console', level, query });
  const isFiltered = level !== 'all' || query.trim() !== '';

  useLayoutEffect(() => {
    const node = viewport.current;
    if (node !== null && isFollowing.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [rows.length]);

  const follow = (): void => {
    const node = viewport.current;
    if (node !== null) {
      isFollowing.current =
        node.scrollHeight - node.scrollTop - node.clientHeight < FOLLOW_SLACK_PX;
    }
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
    log.clear({ kind: 'console' });
    setSendNote(null);
  };

  const tools = (
    <>
      <BrowserConsoleLevelMenu level={level} onChange={changeLevel} />
      <SearchField
        ariaLabel={NAMES.searchMessages}
        placeholder={NAMES.searchMessages}
        value={query}
        onChange={setQuery}
        className={cn('flex-1', isToolsInHead ? 'min-w-0 max-w-56' : 'min-w-32')}
      />
      <Button variant="quiet" size="xs" disabled={counts.console === 0} onClick={clear}>
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 pb-1">
      <BrowserToolsHead
        kind="console"
        counts={counts}
        side={side}
        tools={isToolsInHead ? tools : null}
        onKind={onTab}
        onSide={onSide}
        onClose={onClose}
      />
      {isToolsInHead ? null : (
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-2">{tools}</div>
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
      <ScrollFade
        className="min-h-0 min-w-0 flex-1"
        viewportRef={viewport}
        onViewportScroll={follow}
        isPageScroller={false}
      >
        <div role="log" aria-label="Console messages" className="flex flex-col gap-px px-1">
          {rows.length === 0 ? (
            <EmptyLine className="px-2">
              {isFiltered && counts.console > 0 ? NO_MATCH_TEXT : EMPTY_TEXT}
            </EmptyLine>
          ) : (
            rows.map((entry) => <BrowserConsoleRow key={entry.seq} entry={entry} />)
          )}
        </div>
      </ScrollFade>
    </div>
  );
};
