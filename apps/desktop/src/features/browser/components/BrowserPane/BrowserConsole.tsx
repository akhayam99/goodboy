import { useLayoutEffect, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import { Button, EmptyLine, ICON_SIZE, ScrollFade, SegmentedTabs } from '@goodboy/ui';
import { useHandOutputToAgent } from '../../../../shared/hooks/useHandOutputToAgent';
import { consoleAttachmentOf } from '../../consoleAttachmentOf';
import { consoleCounts } from '../../consoleCounts';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import type { BrowserConsoleKind, BrowserPaneModel } from '../../types';
import { BrowserConsoleRow } from './BrowserConsoleRow';

type Props = {
  readonly model: BrowserPaneModel;
  readonly title: string;
  readonly log: ConsoleEntries;
};

const FOLLOW_SLACK_PX = 24;

const COUNT_CLASS =
  'rounded-md bg-fill px-2 py-0.5 text-eyebrow tabular-nums text-muted-foreground';

const FAILURE_TEXT = {
  read: "Couldn't read the console",
  silent: 'Console stopped reporting',
} as const;

const EMPTY_TEXT = {
  console: 'Nothing logged since the last load',
  network: 'No failed request since the last load',
} as const satisfies Record<BrowserConsoleKind, string>;

const AGENT_GONE_TEXT = "The agent isn't in this session anymore. Pick one and try again.";

export const BrowserConsole = ({ model, title, log }: Props) => {
  const [kind, setKind] = useState<BrowserConsoleKind>('console');
  const [sendNote, setSendNote] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const isFollowing = useRef(true);
  const target = useHandOutputToAgent({ sessionId: model.sessionId });
  const counts = consoleCounts({ entries: log.entries });
  const rows = log.entries.filter((entry) => entry.kind === kind);
  const canSend = target.canHandOff && target.agentId !== null && log.entries.length > 0;

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

  const send = (): void => {
    if (target.agentId === null) {
      return;
    }
    const handoff = consoleAttachmentOf({ entries: log.entries, title, url: model.address });
    const isQueued = target.queue({ agentId: target.agentId, handoff });
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
      className="flex h-40 shrink-0 flex-col gap-1 overflow-hidden rounded-lg border border-border-soft bg-background p-1"
    >
      <div className="flex h-8 shrink-0 items-center gap-2 px-1">
        <SegmentedTabs
          size="xs"
          ariaLabel="Console or Network"
          value={kind}
          onChange={setKind}
          options={[
            {
              value: 'console',
              label: 'Console',
              badge: <span className={COUNT_CLASS}>{counts.console}</span>,
            },
            {
              value: 'network',
              label: 'Network',
              badge: <span className={COUNT_CLASS}>{counts.network}</span>,
            },
          ]}
        />
        <span className="min-w-0 flex-1 truncate text-meta text-faint-foreground">
          Since the last load
        </span>
        <Button variant="quiet" size="xs" disabled={rows.length === 0} onClick={clear}>
          Clear
        </Button>
        <Button variant="secondary" size="xs" disabled={!canSend} onClick={send}>
          <Bot size={ICON_SIZE.row} aria-hidden />
          {model.pageSend.label}
        </Button>
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
            aria-label={kind === 'console' ? 'Console messages' : 'Failed requests'}
            className="flex flex-col gap-px"
          >
            {rows.length === 0 ? (
              <EmptyLine className="px-2">{EMPTY_TEXT[kind]}</EmptyLine>
            ) : (
              rows.map((entry) => <BrowserConsoleRow key={entry.seq} entry={entry} />)
            )}
          </div>
        </ScrollFade>
      </div>
    </section>
  );
};
