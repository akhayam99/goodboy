import type { ReactNode } from 'react';
import type { AgentId, OpenQuestion, SessionId } from '@goodboy/types';
import type { TranscriptRow } from '../../utils/cluster-operations';
import type { ThinkingContext } from '../../utils/thinking-context';
import { OperationsCluster } from '../OperationsCluster';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { TranscriptCard } from '../TranscriptCards';
import { OpenQuestionCluster } from './OpenQuestionCluster';
import { dayKey, formatDayLabel } from './lib';

type Props = {
  rows: ReadonlyArray<TranscriptRow>;
  oqByTurnOrdinal: ReadonlyMap<number | null, ReadonlyArray<OpenQuestion>>;
  sessionId: SessionId;
  selectedAgentId: AgentId | null;
  workingDir: string | null;
  onRefreshAuth: () => void;
  onOpenDiff: (filePath: string) => void;
  isThinking: boolean;
  thinkingContext: ThinkingContext;
};

export const TranscriptRows = ({
  rows,
  oqByTurnOrdinal,
  sessionId,
  selectedAgentId,
  workingDir,
  onRefreshAuth,
  onOpenDiff,
  isThinking,
  thinkingContext,
}: Props) => {
  const out: ReactNode[] = [];
  let lastDay: string | null = null;
  let userTurnOrdinal = 0;

  const flushOrdinal = (ordinal: number) => {
    const cards = oqByTurnOrdinal.get(ordinal);
    if (!cards || cards.length === 0) {
      return;
    }
    out.push(
      <li key={`oq-${ordinal}`}>
        <OpenQuestionCluster
          questions={cards}
          sessionId={sessionId}
          viewerAgentId={selectedAgentId}
        />
      </li>,
    );
  };

  rows.forEach((row, idx) => {
    if (row.kind === 'item' && row.item.kind === 'done') {
      return;
    }
    if (row.kind === 'item' && row.item.kind === 'oq_answer') {
      flushOrdinal(userTurnOrdinal);
      userTurnOrdinal += 1;
      return;
    }
    if (row.kind === 'item' && row.item.kind === 'user_text') {
      flushOrdinal(userTurnOrdinal);
      userTurnOrdinal += 1;
      const at = row.item.at;
      const day = dayKey(at);
      const dayChanged = day !== lastDay;
      if (dayChanged) {
        out.push(
          <li key={`day-${day}-${idx}`} className="flex justify-center">
            <span className="rounded-full border border-border-soft bg-background px-2 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
              {formatDayLabel(at)}
            </span>
          </li>,
        );
        lastDay = day;
      }
    }
    out.push(
      <li key={row.key} className="[content-visibility:auto] [contain-intrinsic-size:auto_80px]">
        {row.kind === 'operations' ? (
          <OperationsCluster
            items={row.items}
            sessionId={sessionId}
            agentId={selectedAgentId}
            workingDir={workingDir}
            onRefreshAuth={onRefreshAuth}
            onOpenDiff={onOpenDiff}
          />
        ) : (
          <TranscriptCard
            item={row.item}
            sessionId={sessionId}
            agentId={selectedAgentId}
            workingDir={workingDir}
            onRefreshAuth={onRefreshAuth}
            onOpenDiff={onOpenDiff}
          />
        )}
      </li>,
    );
  });

  flushOrdinal(userTurnOrdinal);
  const remainingOrdinals = [...oqByTurnOrdinal.keys()]
    .filter((ordinal): ordinal is number => ordinal !== null && ordinal > userTurnOrdinal)
    .sort((a, b) => a - b);
  for (const ordinal of remainingOrdinals) {
    flushOrdinal(ordinal);
  }
  const tailCards = oqByTurnOrdinal.get(null);
  if (tailCards != null && tailCards.length > 0) {
    out.push(
      <li key="oq-tail">
        <OpenQuestionCluster
          questions={tailCards}
          sessionId={sessionId}
          viewerAgentId={selectedAgentId}
        />
      </li>,
    );
  }
  return (
    <>
      {out}
      {isThinking ? (
        <li>
          <ThinkingIndicator context={thinkingContext} />
        </li>
      ) : null}
    </>
  );
};
