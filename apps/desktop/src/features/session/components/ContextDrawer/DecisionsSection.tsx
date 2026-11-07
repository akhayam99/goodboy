import { replacedDecisionNumbersOf } from './replacedDecisionNumbersOf';
import { isRemovedByYou } from './isRemovedByYou';
import { matchesClosedSearch } from './matchesClosedSearch';
import { revealDecisionRow } from './revealDecisionRow';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import {
  EmptyLine,
  ICON_SIZE,
  Input,
  SegmentedTabs,
  SkeletonText,
  type SegmentedTabOption,
  FOCUS_RING,
  cn,
} from '@goodboy/ui';
import type { DecisionOp } from '@goodboy/core/context';
import type { AgentId, SessionDecision, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectContextBaseline } from '../../../../store/slices/contextDrawer/selectContextBaseline';

import { type DecisionChangesSince } from '../../../../store/slices/contextDrawer/decisionChangesSince';
import { decisionChangeLabelOf } from './decisionChangeLabelOf';
import { decisionRowsOf } from './decisionRowsOf';
import { AddDecisionRow } from './AddDecisionRow';
import { ClosedDecisionRow } from './ClosedDecisionRow';
import { DecisionRowItem } from './DecisionRowItem';
import { landingLiveKey } from '../../../chat/reveal/landingLiveKey';
import { EnteringRow } from './EnteringRow';
import { RawDocumentEditor } from './RawDocumentEditor';
import {
  activeDecisionByline,
  closedDecisionByline,
  decisionAge,
  isAfterBaseline,
} from './decisionByline';

const HIGHLIGHT_MS = 1200;
const OPENED_HIGHLIGHT_MS = 2400;
const EMPTY_LEDGER: ReadonlyArray<SessionDecision> = [];
const NO_NUMBERS: ReadonlySet<number> = new Set();

type ClosedFilter = 'removed' | 'replaced';

type WriteParams = { readonly op: DecisionOp };
type NumberParams = { readonly number: number };

type Props = {
  readonly sessionId: SessionId;
  readonly changes: DecisionChangesSince;
  readonly highlight: ReadonlyArray<number>;
  readonly isLocked: boolean;
  readonly isRawEditing: boolean;
  readonly sourceValue: string;
  readonly onWriteSource: (next: string) => Promise<boolean>;
  readonly onCloseRawEditor: () => void;
  readonly pendingRemovals: ReadonlySet<number>;
  readonly onMarkRemoved: (number: number) => void;
  readonly onUnmarkRemoved: (number: number) => void;
  readonly onClearRemovals: () => void;
};

export const DecisionsSection = ({
  sessionId,
  changes,
  highlight,
  isLocked,
  isRawEditing,
  sourceValue,
  onWriteSource,
  onCloseRawEditor,
  pendingRemovals,
  onMarkRemoved,
  onUnmarkRemoved,
  onClearRemovals,
}: Props) => {
  const ledger = useAppStore((state) => state.sessionDecisions[sessionId]);
  const baseline = useAppStore((state) => selectContextBaseline({ state, sessionId }));
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId]);
  const loadSessionDecisions = useAppStore((state) => state.loadSessionDecisions);
  const applySessionDecisionOps = useAppStore((state) => state.applySessionDecisionOps);
  const reportError = useAppStore((state) => state.reportError);
  const [isClosedOpen, setIsClosedOpen] = useState(false);
  const [closedFilter, setClosedFilter] = useState<ClosedFilter>('removed');
  const [closedQuery, setClosedQuery] = useState('');
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [highlighted, setHighlighted] = useState<ReadonlySet<number>>(NO_NUMBERS);
  const [highlightMs, setHighlightMs] = useState(HIGHLIGHT_MS);
  const rows = useRef(new Map<number, HTMLDivElement>());
  const firstNumbers = useRef<ReadonlySet<number> | null>(null);

  useEffect(() => {
    void loadSessionDecisions(sessionId);
  }, [loadSessionDecisions, sessionId]);

  useEffect(() => {
    if (highlighted.size === 0) {
      return;
    }
    const timer = window.setTimeout(() => setHighlighted(NO_NUMBERS), highlightMs);
    return () => window.clearTimeout(timer);
  }, [highlighted, highlightMs]);

  const hasLedger = ledger !== undefined;
  const decisions = ledger ?? EMPTY_LEDGER;
  const { activeRows, closed } = useMemo(
    () => decisionRowsOf({ decisions, changes, pendingRemovals }),
    [decisions, changes, pendingRemovals],
  );

  useEffect(() => {
    if (highlight.length === 0 || !hasLedger) {
      return;
    }
    const wanted = new Set(highlight);
    const closedWanted = closed.filter((row) => wanted.has(row.number));
    if (closedWanted.length > 0) {
      setIsClosedOpen(true);
      setClosedQuery('');
      const hasRemoved = closedWanted.some((row) => isRemovedByYou({ row }));
      const hasReplaced = closedWanted.some((row) => !isRemovedByYou({ row }));
      if (hasRemoved && !hasReplaced) {
        setClosedFilter('removed');
      }
      if (hasReplaced && !hasRemoved) {
        setClosedFilter('replaced');
      }
    }
    setHighlightMs(OPENED_HIGHLIGHT_MS);
    setHighlighted(wanted);
    const frame = window.requestAnimationFrame(() => {
      revealDecisionRow({ rows: rows.current, numbers: wanted });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlight, hasLedger, closed]);

  const agentNames = useMemo(
    () => new Map<AgentId, string>((agents ?? []).map((agent) => [agent.id, agent.name])),
    [agents],
  );
  const removedByYou = useMemo(() => closed.filter((row) => isRemovedByYou({ row })), [closed]);
  const replaced = useMemo(() => closed.filter((row) => !isRemovedByYou({ row })), [closed]);
  const closedRows = closedFilter === 'removed' ? removedByYou : replaced;
  const filteredClosedRows = useMemo(
    () => closedRows.filter((row) => matchesClosedSearch({ row, query: closedQuery })),
    [closedRows, closedQuery],
  );
  const replacedBy = useMemo(() => replacedDecisionNumbersOf({ decisions }), [decisions]);

  if (isRawEditing) {
    return (
      <RawDocumentEditor
        value={sourceValue}
        label="Decisions source"
        onWrite={onWriteSource}
        onClose={onCloseRawEditor}
      />
    );
  }

  if (ledger === undefined) {
    return <SkeletonText lines={2} />;
  }

  if (firstNumbers.current === null) {
    firstNumbers.current = new Set(ledger.map((row) => row.number));
  }
  const seenAtFirst = firstNumbers.current;
  const nowMs = Date.now();
  const actor = { author: 'user' as const, agentId: null, turnOrdinal: null };
  const write = async ({ op }: WriteParams): Promise<boolean> => {
    try {
      await applySessionDecisionOps({ sessionId, ops: [op], actor });
      return true;
    } catch (error: unknown) {
      void reportError({
        recovery: CHECK_STATE,
        title: "Couldn't save the decision",
        error,
        sessionId,
      });
      return false;
    }
  };
  const jumpTo = ({ number }: NumberParams) => {
    const isClosed = closed.some((row) => row.number === number);
    if (isClosed) {
      if (!isClosedOpen) {
        setIsClosedOpen(true);
      }
      setClosedQuery('');
      const row = closed.find((candidate) => candidate.number === number);
      if (row !== undefined) {
        setClosedFilter(isRemovedByYou({ row }) ? 'removed' : 'replaced');
      }
    }
    window.requestAnimationFrame(() => {
      revealDecisionRow({ rows: rows.current, numbers: [number] });
    });
    setHighlightMs(HIGHLIGHT_MS);
    setHighlighted(new Set([number]));
  };
  const refFor =
    ({ number }: NumberParams) =>
    (element: HTMLDivElement | null) => {
      if (element === null) {
        rows.current.delete(number);
        return;
      }
      rows.current.set(number, element);
    };
  const removeDecision = async ({ number }: NumberParams) => {
    const isSaved = await write({ op: { kind: 'withdraw', number, reason: null } });
    if (!isSaved) {
      return;
    }
    onMarkRemoved(number);
    setOpenNumber((current) => (current === number ? null : current));
  };
  const undoRemove = async ({ number }: NumberParams) => {
    const isSaved = await write({ op: { kind: 'restore', number } });
    if (isSaved) {
      onUnmarkRemoved(number);
    }
  };
  const undoAllRemovals = async () => {
    const numbers = [...pendingRemovals];
    if (numbers.length === 0) {
      return;
    }
    try {
      await applySessionDecisionOps({
        sessionId,
        ops: numbers.map((number) => ({ kind: 'restore' as const, number })),
        actor,
      });
      onClearRemovals();
    } catch (error: unknown) {
      void reportError({
        recovery: CHECK_STATE,
        title: "Couldn't restore the decisions",
        error,
        sessionId,
      });
    }
  };

  const closedFilterOptions: ReadonlyArray<SegmentedTabOption<ClosedFilter>> = [
    { value: 'removed', label: 'Removed by you', badge: String(removedByYou.length) },
    { value: 'replaced', label: 'Replaced', badge: String(replaced.length) },
  ];

  return (
    <div className="flex flex-col gap-3">
      {activeRows.length === 0 ? (
        <EmptyLine className="text-body text-muted-foreground">
          No decisions yet. Agents record one when they settle a choice; you can add your own.
        </EmptyLine>
      ) : (
        <div className="flex flex-col gap-2">
          {pendingRemovals.size === 0 ? null : (
            <div className="flex items-center gap-1 px-2 text-meta text-muted-foreground">
              <span>{`${pendingRemovals.size} change${pendingRemovals.size > 1 ? 's' : ''} on this visit`}</span>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={() => void undoAllRemovals()}
                className={cn(
                  'inline-flex items-center gap-2 rounded-sm px-1 py-0.5 text-foreground hover:bg-hover',
                  FOCUS_RING,
                )}
              >
                <Undo2 size={ICON_SIZE.row} aria-hidden />
                Undo all
              </button>
            </div>
          )}
          <div className="-mx-2 flex flex-col gap-0.5">
            {activeRows.map((row) => (
              <EnteringRow key={row.id} isEntering={!seenAtFirst.has(row.number)}>
                <DecisionRowItem
                  number={row.number}
                  text={row.text}
                  liveKey={
                    row.agentId === null
                      ? null
                      : landingLiveKey({ scope: 'decisions', id: sessionId })
                  }
                  why={row.why}
                  byline={activeDecisionByline({
                    decision: row,
                    agentNames,
                    replaces: replacedBy.get(row.number) ?? null,
                    nowMs,
                  })}
                  changeLabel={decisionChangeLabelOf({ row, changes })}
                  isClosed={row.status !== 'active'}
                  reworded={
                    row.previousText !== null &&
                    row.rewordedAt !== null &&
                    (baseline === null || isAfterBaseline({ iso: row.rewordedAt, baseline }))
                      ? {
                          age: decisionAge({ iso: row.rewordedAt, nowMs }),
                          previousText: row.previousText,
                        }
                      : null
                  }
                  isLocked={isLocked}
                  isHighlighted={highlighted.has(row.number)}
                  isOpen={openNumber === row.number}
                  isRemoved={pendingRemovals.has(row.number)}
                  rowRef={refFor({ number: row.number })}
                  onToggleOpen={() =>
                    setOpenNumber((current) => (current === row.number ? null : row.number))
                  }
                  onReword={(text) =>
                    void write({ op: { kind: 'reword', number: row.number, text } })
                  }
                  onRemove={() => void removeDecision({ number: row.number })}
                  onUndoRemove={() => void undoRemove({ number: row.number })}
                />
              </EnteringRow>
            ))}
          </div>
        </div>
      )}
      {closed.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            aria-expanded={isClosedOpen}
            onClick={() => setIsClosedOpen(!isClosedOpen)}
            className={cn(
              'flex items-center gap-2 self-start rounded-md px-2 py-1 text-meta text-muted-foreground hover:bg-hover',
              FOCUS_RING,
            )}
          >
            {isClosedOpen ? (
              <ChevronDown size={ICON_SIZE.row} aria-hidden />
            ) : (
              <ChevronRight size={ICON_SIZE.row} aria-hidden />
            )}
            Replaced and removed
            <span className="text-faint-foreground tabular-nums">{closed.length}</span>
          </button>
          {isClosedOpen ? (
            <div className="flex flex-col gap-2 px-1">
              <div className="flex items-center gap-2">
                <SegmentedTabs
                  size="sm"
                  ariaLabel="Show"
                  options={closedFilterOptions}
                  value={closedFilter}
                  onChange={setClosedFilter}
                />
                <Input
                  type="search"
                  aria-label="Search replaced and removed decisions"
                  placeholder="Search"
                  value={closedQuery}
                  onChange={(event) => setClosedQuery(event.target.value)}
                  className="h-7 flex-1"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                {filteredClosedRows.length === 0 ? (
                  <p className="px-2 text-meta text-faint-foreground">
                    {`Nothing matches "${closedQuery}"`}
                  </p>
                ) : (
                  filteredClosedRows.map((row) => (
                    <ClosedDecisionRow
                      key={row.id}
                      number={row.number}
                      isHighlighted={highlighted.has(row.number)}
                      rowRef={refFor({ number: row.number })}
                      text={row.text}
                      reason={row.reason}
                      byline={closedDecisionByline({ decision: row, agentNames })}
                      isLocked={isLocked}
                      onJump={(number) => jumpTo({ number })}
                      onRestore={
                        isRemovedByYou({ row })
                          ? () => void write({ op: { kind: 'restore', number: row.number } })
                          : null
                      }
                    />
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
      <AddDecisionRow
        isLocked={isLocked}
        onAdd={(text) => void write({ op: { kind: 'add', text } })}
      />
    </div>
  );
};
