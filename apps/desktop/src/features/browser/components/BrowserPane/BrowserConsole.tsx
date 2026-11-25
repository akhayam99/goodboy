import { useLayoutEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button, EmptyLine, ScrollFade, SearchField, SegmentedTabs } from '@goodboy/ui';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { consoleAttachmentOf } from '../../consoleAttachmentOf';
import { consoleCounts } from '../../consoleCounts';
import { consoleRowsOf, type ConsoleLevelFilter } from '../../consoleRowsOf';
import { queueConsoleHandoff } from '../../queueConsoleHandoff';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import type { BrowserConsoleKind, BrowserPaneModel } from '../../types';
import { BrowserConsoleLevelMenu } from './BrowserConsoleLevelMenu';
import { BrowserConsoleRow } from './BrowserConsoleRow';
import { BrowserConsoleSendMenu } from './BrowserConsoleSendMenu';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly model: BrowserPaneModel;
  readonly title: string;
  readonly log: ConsoleEntries;
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

export const BrowserConsole = ({ model, title, log }: Props) => {
  const [kind, setKind] = useState<BrowserConsoleKind>('console');
  const [level, setLevel] = useState<ConsoleLevelFilter>('all');
  const [query, setQuery] = useState('');
  const [sendNote, setSendNote] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const isFollowing = useRef(true);
  const openSession = useOpenSession();
  const counts = consoleCounts({ entries: log.entries });
  const rows = consoleRowsOf({ entries: log.entries, kind, level, query });
  const isFiltered = level !== 'all' || query.trim() !== '';

  useLayoutEffect(() => {
    const node = viewport.current;
    if (node !== null && isFollowing.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [rows.length, kind]);

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

  return (
    <section
      aria-label="Console"
      className="flex h-48 shrink-0 flex-col gap-1 overflow-hidden rounded-lg border border-border-soft bg-background p-1"
    >
      <div className="flex h-8 shrink-0 items-center gap-2 px-1">
        <SegmentedTabs
          size="xs"
          ariaLabel="Console or Network"
          value={kind}
          onChange={(next) => changeKind({ next })}
          options={[
            { value: 'console', label: 'Console', badge: counts.console },
            { value: 'network', label: 'Network', badge: counts.network },
          ]}
        />
        <BrowserConsoleLevelMenu kind={kind} level={level} onChange={changeLevel} />
        <SearchField
          ariaLabel={SEARCH_LABEL[kind]}
          placeholder={SEARCH_LABEL[kind]}
          value={query}
          onChange={setQuery}
          className="min-w-0 flex-1"
        />
        <Button variant="quiet" size="xs" disabled={counts[kind] === 0} onClick={clear}>
          Clear
        </Button>
        <BrowserConsoleSendMenu
          sessionId={model.sessionId}
          isDisabled={log.entries.length === 0}
          onSend={send}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {log.failure === null ? null : (
          <p role="status" className="shrink-0 px-2 text-meta text-danger">
            {FAILURE_TEXT[log.failure]}
          </p>
        )}
        {sendNote === null ? null : (
          <p role="status" className="shrink-0 px-2 text-meta text-muted-foreground">
            {sendNote}
          </p>
        )}
        <ScrollFade
          className="min-h-0 flex-1"
          viewportRef={viewport}
          onViewportScroll={follow}
          isPageScroller={false}
        >
          <div
            role="log"
            aria-label={kind === 'console' ? 'Console messages' : 'Requests'}
            className="flex flex-col gap-px"
          >
            {rows.length === 0 ? (
              <EmptyLine className="px-2">
                {isFiltered && counts[kind] > 0 ? NO_MATCH_TEXT : EMPTY_TEXT[kind]}
              </EmptyLine>
            ) : (
              rows.map((entry) => <BrowserConsoleRow key={entry.seq} entry={entry} />)
            )}
          </div>
        </ScrollFade>
      </div>
    </section>
  );
};
