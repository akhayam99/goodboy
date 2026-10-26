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
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TurnFooterInfo } from '../../utils/turnOutcome';
import { OperationsCluster } from '../OperationsCluster';
import { PlanChecklist } from '../PlanChecklist';
import { TurnSummaryLine } from '../TurnSummaryLine';
import type { OpenTranscriptAt } from '../../openTranscriptAt';
import type { StopPhase } from '../../../../shared/hooks/useAgentStop';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { ConversationTail } from '../ConversationTail';
import { TranscriptCard } from '../TranscriptCards';
import { OpenQuestionCluster } from './OpenQuestionCluster';
import { BriefCard } from './BriefCard';
import { NewRowsDivider } from './NewRowsDivider';
import { SlackDraftCard } from './SlackDraftCard';
import { dayKey, formatDayLabel } from './lib';
import { planBlockVersions } from './planBlockVersions';
import { rowEstimatePx } from './rowEstimatePx';
import { rowHeightCache } from './rowHeightCache';
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
  thinkingPhrase: string;
  thinkingStartedAt?: IsoDateTime | null;
  onRetryRun: (params: RetryRunParams) => void;
  retryingRunId: ProviderRunId | null;
  mountSuggestionsByRun?: ReadonlyMap<ProviderRunId, ReactNode>;
  activeRunId?: ProviderRunId | null;
  turnFooters?: ReadonlyMap<ProviderRunId, TurnFooterInfo>;
  briefLabel?: string;
  insertions?: ReadonlyArray<TranscriptInsertion>;
  onOpenTranscript?: OpenTranscriptAt;
  onStop?: () => void;
  isStepsOnly?: boolean;
  waitingFor?: string | null;
  stopLabel?: string;
  stopPhase?: StopPhase;
  clockStepAgentId?: AgentId;
  newFromKey?: string | null;
};

const STEPS_ONLY_HIDDEN = new Set<TranscriptItem['kind']>(['assistant_text', 'usage']);

type HeadingParams = {
  readonly text: string;
};

const turnHeadingOf = ({ text }: HeadingParams): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '') ?? 'Turn';

type VisibilityParams = {
  readonly px: number;
};

const RAIL_ROW_PX = 56;

const visibilityStyle = ({ px }: VisibilityParams): CSSProperties => ({
  contentVisibility: 'auto',
  containIntrinsicSize: `auto ${px}px`,
});

type CacheKeyParams = {
  readonly agentId: AgentId | null;
  readonly isStepsOnly: boolean;
  readonly key: string;
};

const heightKeyOf = ({ agentId, isStepsOnly, key }: CacheKeyParams): string =>
  `${agentId ?? 'none'}:${isStepsOnly ? 'steps' : 'record'}:${key}`;

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
  thinkingPhrase,
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
  isStepsOnly = false,
  waitingFor = null,
  stopLabel,
  stopPhase,
  clockStepAgentId,
  newFromKey = null,
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
  let turnIndex = -1;
  const firstAnswerIndex = rows.findIndex(
    (row) => row.kind === 'summary' || (row.kind === 'item' && row.item.kind === 'assistant_text'),
  );
  let railGroup: Array<ReactNode> = [];
  let railGroupKey: string | null = null;

  const flushRailGroup = () => {
    if (railGroup.length === 0 || railGroupKey === null) {
      return;
    }
    const railKey = heightKeyOf({
      agentId: selectedAgentId,
      isStepsOnly,
      key: `workflow-rail-${railGroupKey}-${railGroup.length}`,
    });
    out.push(
      <li
        key={`workflow-rail-${railGroupKey}`}
        data-anchor-key={railKey}
        className="flex flex-col"
        style={visibilityStyle({
          px: rowHeightCache.read({ key: railKey }) ?? RAIL_ROW_PX * railGroup.length,
        })}
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
    if (isStepsOnly || !cards || cards.length === 0) {
      return;
    }
    out.push(
      <li key={`oq-${ordinal}`}>
        <OpenQuestionCluster questions={cards} sessionId={sessionId} />
      </li>,
    );
  };

  rows.forEach((row, idx) => {
    if (newFromKey !== null && row.key === newFromKey) {
      flushRailGroup();
      out.push(<NewRowsDivider key={`new-${row.key}`} />);
    }
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
              <span className="text-meta text-muted-foreground">{formatDayLabel(at)}</span>
            </li>,
          );
        }
        lastDay = day;
      }
      if (!(row.item.kind === 'user_text' && row.item.isOperatorEcho === true)) {
        turnIndex += 1;
      }
      if (isStepsOnly && row !== briefRow) {
        flushRailGroup();
        out.push(
          <li key={row.key} data-turn-heading={turnIndex}>
            <p className="truncate text-meta text-muted-foreground">
              {turnHeadingOf({ text: row.item.text })}
            </p>
          </li>,
        );
        return;
      }
    }
    if (isStepsOnly && row.kind === 'item' && STEPS_ONLY_HIDDEN.has(row.item.kind)) {
      return;
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
    const heightKey = heightKeyOf({ agentId: selectedAgentId, isStepsOnly, key: row.key });
    out.push(
      <li
        key={row.key}
        data-anchor-key={heightKey}
        style={visibilityStyle({
          px:
            rowHeightCache.read({ key: heightKey }) ??
            rowEstimatePx({ row, isClusterOpen: isStepsOnly }),
        })}
      >
        {row.kind === 'summary' ? (
          <TurnSummaryLine
            steps={row.steps}
            turn={Math.max(0, turnIndex)}
            {...(onOpenTranscript !== undefined && { onOpenTranscript })}
          />
        ) : row.kind === 'plan' ? (
          <PlanChecklist checklist={row.checklist} isLive={activeRunId != null} />
        ) : row.kind === 'operations' ? (
          <OperationsCluster
            items={row.items}
            isInitiallyOpen={isStepsOnly}
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
            isBrief={
              (row.item.kind === 'user_text' || row.item.kind === 'handoff') &&
              turnIndex === 0 &&
              firstAnswerIndex > idx
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
  if (!isStepsOnly && tailCards != null && tailCards.length > 0) {
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
            <ThinkingIndicator phrase={thinkingPhrase} startedAt={thinkingStartedAt} />
          ) : (
            <ConversationTail
              phrase={thinkingPhrase}
              onStop={onStop}
              startedAt={thinkingStartedAt}
              waitingFor={waitingFor}
              {...(stopLabel !== undefined && { stopLabel })}
              {...(stopPhase !== undefined && { stopPhase })}
              {...(clockStepAgentId !== undefined && { stepAgentId: clockStepAgentId })}
            />
          )}
        </li>
      ) : null}
    </>
  );
};
