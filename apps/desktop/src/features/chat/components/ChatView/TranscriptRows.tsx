import type { RetryRunParams } from '../../retryRun';
import type { CSSProperties, ReactNode } from 'react';
import type {
  AgentId,
  IntegrationDraft,
  IsoDateTime,
  OpenQuestion,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import type { ConversationRow } from '../../utils/conversationRows';
import type { ThinkingContext } from '../../utils/thinking-context';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TurnFooterInfo } from '../../utils/turnOutcome';
import { OperationsCluster } from '../OperationsCluster';
import { PlanChecklist } from '../PlanChecklist';
import { TurnSummaryLine } from '../TurnSummaryLine';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { ConversationTail } from '../ConversationTail';
import { TranscriptCard } from '../TranscriptCards';
import { OpenQuestionCluster } from './OpenQuestionCluster';
import { BriefCard } from './BriefCard';
import { SlackDraftCard } from './SlackDraftCard';
import { dayKey, formatDayLabel } from './lib';
import { planBlockVersions } from './planBlockVersions';
import { rowEstimatePx } from './rowEstimatePx';
import { isWorkflowRailRow } from './workflowRailGroup';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';

type Props = {
  rows: ReadonlyArray<ConversationRow>;
  oqByTurnOrdinal: ReadonlyMap<number | null, ReadonlyArray<OpenQuestion>>;
  slackDrafts?: ReadonlyArray<IntegrationDraft>;
  sessionId: SessionId;
  selectedAgentId: AgentId | null;
  workingDir: string | null;
  onRefreshAuth: () => void;
  onOpenDiff: (filePath: string) => void;
  isThinking: boolean;
  thinkingContext: ThinkingContext;
  thinkingStartedAt?: IsoDateTime | null;
  onRetryRun: (params: RetryRunParams) => void;
  retryingRunId: ProviderRunId | null;
  mountSuggestionsByRun?: ReadonlyMap<ProviderRunId, ReactNode>;
  activeRunId?: ProviderRunId | null;
  turnFooters?: ReadonlyMap<ProviderRunId, TurnFooterInfo>;
  briefLabel?: string;
  insertions?: ReadonlyArray<TranscriptInsertion>;
  onOpenTranscript?: () => void;
  onStop?: () => void;
};

type VisibilityParams = {
  readonly px: number;
};

const RAIL_ROW_PX = 56;

const visibilityStyle = ({ px }: VisibilityParams): CSSProperties => ({
  contentVisibility: 'auto',
  containIntrinsicSize: `auto ${px}px`,
});

type FlushParams = {
  readonly beforeMs: number | null;
};

const RUN_BEARING_KINDS = new Set<TranscriptItem['kind']>([
  'decision_note',
  'artifact_capture_failed',
  'error',
  'permission_request',
  'permission_decision',
]);

const rowRunId = ({ row }: { readonly row: ConversationRow }): ProviderRunId | null => {
  if (row.kind !== 'item' || !RUN_BEARING_KINDS.has(row.item.kind)) {
    return null;
  }
  return 'runId' in row.item ? (row.item.runId ?? null) : null;
};

const lastRowIndexByRun = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ConversationRow>;
}): ReadonlyMap<ProviderRunId, number> => {
  const byRun = new Map<ProviderRunId, number>();
  rows.forEach((row, index) => {
    const runId = rowRunId({ row });
    if (runId !== null) {
      byRun.set(runId, index);
    }
  });
  return byRun;
};

export const TranscriptRows = ({
  rows,
  oqByTurnOrdinal,
  slackDrafts = [],
  sessionId,
  selectedAgentId,
  workingDir,
  onRefreshAuth,
  onOpenDiff,
  isThinking,
  thinkingContext,
  thinkingStartedAt = null,
  onRetryRun,
  retryingRunId,
  mountSuggestionsByRun,
  activeRunId,
  turnFooters,
  briefLabel,
  insertions = [],
  onOpenTranscript,
  onStop,
}: Props) => {
  const out: ReactNode[] = [];
  const suggestions = mountSuggestionsByRun ?? new Map<ProviderRunId, ReactNode>();
  const anchors = lastRowIndexByRun({ rows });
  const planVersions = planBlockVersions({ rows });
  const placedRunIds = new Set<ProviderRunId>();
  const briefRow =
    briefLabel === undefined
      ? null
      : rows.find((row) => row.kind === 'item' && row.item.kind === 'handoff');

  const flushMountSuggestion = ({ index }: { readonly index: number }) => {
    for (const [runId, node] of suggestions) {
      if (placedRunIds.has(runId) || anchors.get(runId) !== index) {
        continue;
      }
      placedRunIds.add(runId);
      out.push(<li key={`mount-suggestion-${runId}`}>{node}</li>);
    }
  };
  const placedInsertions = new Set<string>();
  const flushInsertions = ({ beforeMs }: FlushParams) => {
    for (const insertion of insertions) {
      const isDue =
        beforeMs === null || (insertion.beforeMs !== null && insertion.beforeMs <= beforeMs);
      if (placedInsertions.has(insertion.key) || !isDue) {
        continue;
      }
      placedInsertions.add(insertion.key);
      out.push(<li key={`insertion-${insertion.key}`}>{insertion.node}</li>);
    }
  };
  const todayKey = dayKey(new Date().toISOString());
  let lastDay: string | null = null;
  let userTurnOrdinal = 0;
  let railGroup: Array<ReactNode> = [];
  let railGroupKey: string | null = null;

  const flushRailGroup = () => {
    if (railGroup.length === 0 || railGroupKey === null) {
      return;
    }
    out.push(
      <li
        key={`workflow-rail-${railGroupKey}`}
        className="flex flex-col"
        style={visibilityStyle({ px: RAIL_ROW_PX * railGroup.length })}
      >
        {railGroup}
      </li>,
    );
    railGroup = [];
    railGroupKey = null;
  };

  const flushOrdinal = (ordinal: number) => {
    flushRailGroup();
    const cards = oqByTurnOrdinal.get(ordinal);
    if (!cards || cards.length === 0) {
      return;
    }
    out.push(
      <li key={`oq-${ordinal}`}>
        <OpenQuestionCluster questions={cards} sessionId={sessionId} />
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
    if (
      row.kind === 'item' &&
      (row.item.kind === 'user_text' ||
        row.item.kind === 'handoff' ||
        row.item.kind === 'auto_delivery')
    ) {
      if (!(row.item.kind === 'user_text' && row.item.isOperatorEcho === true)) {
        flushOrdinal(userTurnOrdinal);
        userTurnOrdinal += 1;
      }
      const at = row.item.at;
      flushInsertions({ beforeMs: Date.parse(at) });
      const day = dayKey(at);
      const dayChanged = day !== lastDay;
      const isLeadingToday = lastDay === null && day === todayKey;
      if (dayChanged) {
        if (!isLeadingToday) {
          out.push(
            <li
              key={`day-${day}-${row.key}`}
              data-testid="transcript-day"
              data-align="start"
              className="flex justify-start"
            >
              <span className="rounded-full border border-border-soft bg-background px-2 py-0.5 text-eyebrow text-muted-foreground">
                {formatDayLabel(at)}
              </span>
            </li>,
          );
        }
        lastDay = day;
      }
    }
    if (row.kind === 'item' && isWorkflowRailRow({ row })) {
      railGroupKey = railGroupKey ?? row.key;
      railGroup.push(
        <TranscriptCard
          key={row.key}
          item={row.item}
          sessionId={sessionId}
          agentId={selectedAgentId}
          workingDir={workingDir}
          onRefreshAuth={onRefreshAuth}
          onOpenDiff={onOpenDiff}
          onRetryRun={onRetryRun}
          retryingRunId={retryingRunId}
          activeRunId={activeRunId}
        />,
      );
      return;
    }
    flushRailGroup();
    out.push(
      <li key={row.key} style={visibilityStyle({ px: rowEstimatePx({ row }) })}>
        {row.kind === 'summary' ? (
          <TurnSummaryLine
            steps={row.steps}
            sessionId={sessionId}
            agentId={selectedAgentId}
            workingDir={workingDir}
            onOpenDiff={onOpenDiff}
            onRefreshAuth={onRefreshAuth}
            onRetryRun={onRetryRun}
            retryingRunId={retryingRunId}
            activeRunId={activeRunId ?? null}
            {...(onOpenTranscript !== undefined && { onOpenTranscript })}
          />
        ) : row.kind === 'plan' ? (
          <PlanChecklist checklist={row.checklist} isLive={activeRunId != null} />
        ) : row.kind === 'operations' ? (
          <OperationsCluster
            items={row.items}
            sessionId={sessionId}
            agentId={selectedAgentId}
            workingDir={workingDir}
            onRefreshAuth={onRefreshAuth}
            onOpenDiff={onOpenDiff}
            onRetryRun={onRetryRun}
            retryingRunId={retryingRunId}
            activeRunId={activeRunId}
          />
        ) : row === briefRow && briefLabel !== undefined && row.item.kind === 'handoff' ? (
          <BriefCard label={briefLabel} text={row.item.text} />
        ) : (
          <TranscriptCard
            item={row.item}
            sessionId={sessionId}
            agentId={selectedAgentId}
            workingDir={workingDir}
            onRefreshAuth={onRefreshAuth}
            onOpenDiff={onOpenDiff}
            onRetryRun={onRetryRun}
            retryingRunId={retryingRunId}
            activeRunId={activeRunId}
            planVersion={
              row.item.kind === 'artifact_block' ? (planVersions.get(row.item.key) ?? null) : null
            }
            turnOutcome={
              row.item.kind === 'usage' ? turnFooters?.get(row.item.runId)?.outcome : undefined
            }
            turnStartedAt={
              row.item.kind === 'usage'
                ? (turnFooters?.get(row.item.runId)?.startedAt ?? null)
                : undefined
            }
          />
        )}
      </li>,
    );
    flushMountSuggestion({ index: idx });
  });

  flushOrdinal(userTurnOrdinal);
  flushInsertions({ beforeMs: null });
  const remainingOrdinals = [...oqByTurnOrdinal.keys()]
    .filter((ordinal): ordinal is number => ordinal !== null && ordinal > userTurnOrdinal)
    .sort((a, b) => a - b);
  for (const ordinal of remainingOrdinals) {
    flushOrdinal(ordinal);
  }
  for (const [runId, node] of suggestions) {
    if (placedRunIds.has(runId)) {
      continue;
    }
    placedRunIds.add(runId);
    out.push(<li key={`mount-suggestion-${runId}`}>{node}</li>);
  }
  const tailCards = oqByTurnOrdinal.get(null);
  if (tailCards != null && tailCards.length > 0) {
    out.push(
      <li key="oq-tail">
        <OpenQuestionCluster questions={tailCards} sessionId={sessionId} />
      </li>,
    );
  }
  for (const draft of slackDrafts) {
    out.push(
      <li key={`slack-draft-${draft.id}`}>
        <SlackDraftCard draft={draft} sessionId={sessionId} />
      </li>,
    );
  }
  return (
    <>
      {out}
      {isThinking ? (
        <li>
          {onStop === undefined ? (
            <ThinkingIndicator context={thinkingContext} startedAt={thinkingStartedAt} />
          ) : (
            <ConversationTail
              context={thinkingContext}
              onStop={onStop}
              startedAt={thinkingStartedAt}
            />
          )}
        </li>
      ) : null}
    </>
  );
};
