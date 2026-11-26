import { useState } from 'react';
import { Button, ScrollFade } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectPortRows } from '../../../../store/slices/monitoring/selectPortRows';
import { useHandOutputToAgent } from '../../../../shared/hooks/useHandOutputToAgent';
import { useMonitorPolling } from '../../../../shared/hooks/useMonitorPolling';
import type { BrowserToolsSide } from '../../browserToolsDockPref';
import { errorGroupsOf, type ErrorFrame, type ErrorGroup } from '../../errorGroupsOf';
import { errorsAttachmentOf } from '../../errorsAttachmentOf';
import type { ConsoleEntries } from '../../hooks/useConsoleEntries';
import { sourceFileOf } from '../../sourceFileOf';
import type { BrowserPaneModel, BrowserToolsTab } from '../../types';
import { BrowserToolsHead } from './BrowserToolsHead';
import { ErrorsGroup } from './ErrorsGroup';

type TabParams = {
  readonly next: BrowserToolsTab;
};

type Props = {
  readonly model: BrowserPaneModel;
  readonly title: string;
  readonly log: ConsoleEntries;
  readonly counts: Readonly<Record<BrowserToolsTab, number>>;
  readonly side: BrowserToolsSide;
  readonly isToolsInHead: boolean;
  readonly onTab: (params: TabParams) => void;
  readonly onSide: () => void;
  readonly onClose: () => void;
};

type FrameParams = {
  readonly frame: ErrorFrame;
};

type SendParams = {
  readonly chosen: ReadonlyArray<ErrorGroup>;
};

const AGENT_GONE_TEXT = "The agent isn't in this session anymore. Pick one and try again.";

export const ErrorsTab = ({
  model,
  title,
  log,
  counts,
  side,
  isToolsInHead,
  onTab,
  onSide,
  onClose,
}: Props) => {
  const groups = errorGroupsOf({ entries: log.entries });
  const [openKey, setOpenKey] = useState<string | null>(() => groups[0]?.key ?? null);
  const [note, setNote] = useState<string | null>(null);
  const target = useHandOutputToAgent({ sessionId: model.sessionId });
  const rows = useAppStore(selectPortRows);
  const processes = useAppStore((state) => state.monitorSnapshot?.processes ?? EMPTY_ARRAY);
  useMonitorPolling({ isEnabled: true });
  const agentName = target.agentName ?? 'the agent';

  const fileOf = ({ frame }: FrameParams): string | null =>
    sourceFileOf({
      url: frame.url,
      line: frame.line,
      sessionId: model.sessionId,
      rows,
      processes,
    });
  const hasOwnLine = groups.some((group) =>
    group.frames.some((frame) => fileOf({ frame }) !== null),
  );

  const send = ({ chosen }: SendParams): void => {
    const { agentId } = target;
    if (agentId === null) {
      setNote(AGENT_GONE_TEXT);
      return;
    }
    const handoff = errorsAttachmentOf({ groups: chosen, title, url: model.address, fileOf });
    const isQueued = target.queue({ agentId, handoff });
    setNote(
      isQueued
        ? `Added to your message to ${agentName} as ${handoff.fileName}. Nothing goes until you send.`
        : AGENT_GONE_TEXT,
    );
  };

  const clear = (): void => {
    log.clear({ kind: 'errors' });
    setNote(null);
    onTab({ next: 'console' });
  };

  const tools = (
    <>
      <Button variant="quiet" size="xs" onClick={clear}>
        Clear
      </Button>
      <Button
        variant="secondary"
        size="xs"
        disabled={!target.canHandOff || groups.length === 0}
        onClick={() => send({ chosen: groups })}
      >
        {`Send all to ${agentName}`}
      </Button>
    </>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 pb-1">
      <BrowserToolsHead
        kind="errors"
        counts={counts}
        side={side}
        tools={isToolsInHead ? tools : null}
        onKind={onTab}
        onSide={onSide}
        onClose={onClose}
      />
      {isToolsInHead ? null : (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-2">{tools}</div>
      )}
      {note === null ? null : (
        <p role="status" className="shrink-0 px-3 text-meta text-muted-foreground">
          {note}
        </p>
      )}
      <ScrollFade className="min-h-0 min-w-0 flex-1" isPageScroller={false}>
        <div role="list" aria-label="Errors" className="flex flex-col gap-px px-1">
          {groups.map((group) => (
            <div role="listitem" key={group.key} className="min-w-0">
              <ErrorsGroup
                group={group}
                isOpen={openKey === group.key}
                sendLabel={`Send ${group.text} to ${agentName}`}
                canSend={target.canHandOff}
                fileOf={fileOf}
                onToggle={() => setOpenKey(openKey === group.key ? null : group.key)}
                onSend={() => send({ chosen: [group] })}
              />
            </div>
          ))}
        </div>
      </ScrollFade>
      <p className="shrink-0 px-3 text-meta text-faint-foreground">
        {hasOwnLine
          ? 'Since the last load. Lines in color are files in this worktree.'
          : 'Since the last load.'}
      </p>
    </div>
  );
};
