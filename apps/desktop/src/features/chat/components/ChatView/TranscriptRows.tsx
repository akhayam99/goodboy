import type { RetryRunParams } from '../../retryRun';
import type { ReactNode } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
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
import { ReadingNotes } from '../../readingOrder/ReadingNotes';
import { readingOrderOf } from '../../readingOrder/readingOrderOf';
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
import { dayKey, rowAnchorOf } from './lib';
import { DayDivider } from './DayDivider';
import { TurnHeading } from './TurnHeading';
import { planBlockVersions } from './planBlockVersions';
import { rowVisibilityStyle } from './rowVisibilityStyle';
import { splitTurns } from './splitTurns';
import { lastRowIndexByRun } from './lastRowIndexByRun';
import { rowEstimatePx } from './rowEstimatePx';
import { rowHeightCache } from './rowHeightCache';
import { isWorkflowRailRow } from './workflowRailGroup';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { isTurnStartRow } from './isTurnStartRow';

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

const RAIL_ROW_PX = 56;

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
  const readingRoles = readingOrderOf({ rows, activeRunId: activeRunId ?? null });
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
  let lastFooterRunId: ProviderRunId | null = null;
  const turnStarts = new Set<number>();
  const markTurnStart = () => {
    turnStarts.add(out.length);
  };

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
        style={rowVisibilityStyle({
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
    const isNewDivider = newFromKey !== null && row.key === newFromKey;
    const isTurnStart = isTurnStartRow({ row, previous: rows[idx - 1] });
    if (isNewDivider && !isTurnStart) {
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
      if (isTurnStart) {
        markTurnStart();
        if (isNewDivider) {
          out.push(<NewRowsDivider key={`new-${row.key}`} />);
        }
      }
      const day = dayKey(at);
      const dayChanged = day !== lastDay;
      const isLeadingToday = lastDay === null && day === todayKey;
      if (dayChanged) {
        if (!isLeadingToday) {
          out.push(<DayDivider key={`day-${day}-${row.key}`} at={at} />);
        }
        lastDay = day;
      }
      if (!(row.item.kind === 'user_text' && row.item.isOperatorEcho === true)) {
        turnIndex += 1;
      }
      if (isStepsOnly && row !== briefRow) {
        flushRailGroup();
        out.push(<TurnHeading key={row.key} index={turnIndex} text={row.item.text} />);
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
    const reading = readingRoles.get(row.key);
    if (reading?.kind === 'hidden') {
      return;
    }
    flushRailGroup();
    const previousRunId = row.kind === 'item' && row.item.kind === 'usage' ? lastFooterRunId : null;
    if (row.kind === 'item' && row.item.kind === 'usage') {
      lastFooterRunId = row.item.runId;
    }
    const heightKey = heightKeyOf({ agentId: selectedAgentId, isStepsOnly, key: row.key });
    out.push(
      <li
        key={row.key}
        {...rowAnchorOf({ row, heightKey })}
        style={rowVisibilityStyle({
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
        ) : reading?.kind === 'notes' ? (
          <ReadingNotes role={reading} />
        ) : (
          <TranscriptCard
            {...(reading?.kind === 'answer' && { clampLines: reading.clampLines })}
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
            previousRunId={previousRunId}
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
  if (isThinking) {
    out.push(
      <li key="thinking">
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
      </li>,
    );
  }
  return (
    <>
      {splitTurns({ nodes: out, starts: turnStarts }).map((nodes, turn) => (
        <li key={`turn-${turn}`} data-turn="">
          <ul className={PANE_RHYTHM.transcript.blocks}>{nodes}</ul>
        </li>
      ))}
    </>
  );
};
