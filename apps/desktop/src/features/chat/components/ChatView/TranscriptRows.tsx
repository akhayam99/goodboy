import type { RetryRunParams } from '../../retryRun';
import type { ReactNode, RefObject } from 'react';
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
import type { TurnFooterInfo } from '../../utils/turnOutcome';
import { ReadingNotes } from '../../readingOrder/ReadingNotes';
import { useReadingOrder } from '../../hooks/useReadingOrder';
import { TranscriptSteps } from './TranscriptSteps';
import type { OpenTranscriptAt } from '../../openTranscriptAt';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { TranscriptCard } from '../TranscriptCards';
import type { ErrorDock } from '../TranscriptCards/errorDock';
import { OpenQuestionCluster } from './OpenQuestionCluster';
import { BriefCard } from './BriefCard';
import { NewRowsDivider } from './NewRowsDivider';
import { SlackDraftCard } from './SlackDraftCard';
import { dayKey, rowAnchorOf } from './lib';
import { DayDivider } from './DayDivider';
import { planBlockVersions } from './planBlockVersions';
import { rowVisibilityStyle } from './rowVisibilityStyle';
import { splitTurns } from './splitTurns';
import { lastRowIndexByRun } from './lastRowIndexByRun';
import { rowEstimatePx } from './rowEstimatePx';
import { rowHeightCache } from './rowHeightCache';
import { heightKeyOf } from './heightKeyOf';
import { NoStepsRow } from './NoStepsRow';
import { isWorkflowRailRow } from './workflowRailGroup';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { InsertionRow } from './InsertionRow';
import { placedRowsOf } from './placedRowsOf';
import { dueInsertionsOf } from './dueInsertionsOf';
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
  isStepsOnly?: boolean;
  errorDock?: ErrorDock | null;
  newFromKey?: string | null;
  scrollerRef?: RefObject<HTMLElement | null>;
};

const RAIL_ROW_PX = 56;

type FlushParams = {
  readonly beforeMs: number | null;
};

export const TranscriptRows = ({
  rows: givenRows,
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
  insertions: givenInsertions = [],
  onOpenTranscript,
  isStepsOnly = false,
  errorDock = null,
  newFromKey = null,
  scrollerRef,
}: Props) => {
  const { rows, insertions } = placedRowsOf({ rows: givenRows, insertions: givenInsertions });
  const out: ReactNode[] = [];
  const suggestions = mountSuggestionsByRun ?? new Map<ProviderRunId, ReactNode>();
  const anchors = lastRowIndexByRun({ rows });
  const planVersions = planBlockVersions({ rows });
  const { roles: readingRoles, register } = useReadingOrder({
    rows,
    activeRunId: activeRunId ?? null,
    ...(scrollerRef !== undefined && { scrollerRef }),
  });
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
    for (const insertion of dueInsertionsOf({ insertions, placed: placedInsertions, beforeMs })) {
      placedInsertions.add(insertion.key);
      out.push(<InsertionRow key={`insertion-${insertion.key}`} insertion={insertion} />);
    }
  };
  const todayKey = dayKey(new Date().toISOString());
  let lastDay: string | null = null;
  let userTurnOrdinal = 0;
  let turnIndex = -1;
  let isStepHeadDue = false;
  let railGroup: Array<ReactNode> = [];
  let railGroupKey: string | null = null;
  let lastFooterRunId: ProviderRunId | null = null;
  const turnStarts = new Set<number>();

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
        turnStarts.add(out.length);
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
      if (isStepsOnly) {
        flushRailGroup();
        isStepHeadDue = true;
        return;
      }
    }
    if (isStepsOnly && row.kind === 'item' && row.item.kind !== 'error') {
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
    const turn = Math.max(0, turnIndex);
    const stepHead = isStepHeadDue ? { 'data-turn-heading': turn } : null;
    isStepHeadDue = false;
    out.push(
      <li
        key={row.key}
        ref={(element) => register({ key: row.key, element })}
        {...rowAnchorOf({ row, heightKey })}
        {...stepHead}
        style={rowVisibilityStyle({
          px:
            rowHeightCache.read({ key: heightKey }) ??
            rowEstimatePx({ row, isClusterOpen: isStepsOnly }),
        })}
      >
        {row.kind !== 'item' ? (
          <TranscriptSteps
            row={row}
            turn={turn}
            onOpenTranscript={onOpenTranscript}
            isStepsOnly={isStepsOnly}
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
            isReadOnly={isStepsOnly}
            item={row.item}
            sessionId={sessionId}
            agentId={selectedAgentId}
            workingDir={workingDir}
            onRefreshAuth={onRefreshAuth}
            onOpenDiff={onOpenDiff}
            onRetryRun={onRetryRun}
            retryingRunId={retryingRunId}
            errorDock={errorDock}
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
            turn={turn}
          />
        )}
      </li>,
    );
    flushMountSuggestion({ index: idx });
  });

  flushOrdinal(userTurnOrdinal);
  flushInsertions({ beforeMs: null });
  [...oqByTurnOrdinal.keys()]
    .filter((ordinal): ordinal is number => ordinal !== null && ordinal > userTurnOrdinal)
    .sort((a, b) => a - b)
    .forEach((ordinal) => flushOrdinal(ordinal));
  for (const [runId, node] of suggestions) {
    if (placedRunIds.has(runId) || isStepsOnly) {
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
  for (const draft of isStepsOnly ? [] : slackDrafts) {
    out.push(
      <li key={`slack-draft-${draft.id}`}>
        <SlackDraftCard draft={draft} sessionId={sessionId} />
      </li>,
    );
  }
  if (isStepsOnly && !isThinking && !rows.some((row) => row.kind === 'operations')) {
    out.push(<NoStepsRow key="no-steps" />);
  }
  if (isThinking) {
    out.push(
      <li key="thinking">
        <ThinkingIndicator phrase={thinkingPhrase} startedAt={thinkingStartedAt} />
      </li>,
    );
  }
  return (
    <>
      {splitTurns({ nodes: out, starts: turnStarts }).map((nodes, turn) => (
        <li key={`turn-${turn}`} data-turn="" data-browser-links="">
          <ul className={PANE_RHYTHM.transcript.blocks}>{nodes}</ul>
        </li>
      ))}
    </>
  );
};
