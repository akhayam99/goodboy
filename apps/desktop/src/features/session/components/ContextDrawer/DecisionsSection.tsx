import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import {
  EmptyLine,
  Input,
  SegmentedTabs,
  SkeletonText,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { activeDecisionsNewestFirst, type DecisionOp } from '@goodboy/core';
import type { AgentId, SessionDecision, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ContextBlock } from './ContextBlock';
import {
  hasDecisionChanges,
  type DecisionChangesSince,
} from '../../../../store/slices/contextDrawer/decisionChangesSince';
import { AddDecisionRow } from './AddDecisionRow';
import { DecisionChangesList } from './DecisionChangesList';
import { ClosedDecisionRow } from './ClosedDecisionRow';
import { DecisionRowItem } from './DecisionRowItem';
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

const isRemovedByYou = (row: SessionDecision): boolean =>
  row.status === 'withdrawn' && row.closedBy === 'user';

const matchesClosedSearch = (row: SessionDecision, query: string): boolean => {
  const trimmed = query.trim().toLowerCase().replace(/^#/, '');
  if (trimmed === '') {
    return true;
  }
  return row.text.toLowerCase().includes(trimmed) || String(row.number).startsWith(trimmed);
};

type Props = {
  readonly sessionId: SessionId;
  readonly changes: DecisionChangesSince;
  readonly highlight: ReadonlyArray<number>;
  readonly isLocked: boolean;
  readonly isRawEditing: boolean;
  readonly sourceValue: string;
  readonly onWriteSource: (next: string) => void;
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
  const baseline = useAppStore((state) => state.sessionDecisionsBaseline[sessionId]);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId]);
  const loadSessionDecisions = useAppStore((state) => state.loadSessionDecisions);
  const applySessionDecisionOps = useAppStore((state) => state.applySessionDecisionOps);
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
  const closed = useMemo(
    () =>
      decisions
        .filter((row) => row.status !== 'active' && !pendingRemovals.has(row.number))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [decisions, pendingRemovals],
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
      const hasRemoved = closedWanted.some((row) => isRemovedByYou(row));
      const hasReplaced = closedWanted.some((row) => !isRemovedByYou(row));
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
      const first = [...wanted]
        .map((number) => rows.current.get(number))
        .find((element) => element !== undefined);
      first?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlight, hasLedger, closed]);

  const agentNames = useMemo(
    () => new Map<AgentId, string>((agents ?? []).map((agent) => [agent.id, agent.name])),
    [agents],
  );
  const active = useMemo(() => activeDecisionsNewestFirst({ ledger: decisions }), [decisions]);
  const activeRows = useMemo(
    () =>
      decisions
        .filter((row) => row.status === 'active' || pendingRemovals.has(row.number))
        .sort((a, b) => b.number - a.number),
    [decisions, pendingRemovals],
  );
  const removedByYou = useMemo(() => closed.filter((row) => isRemovedByYou(row)), [closed]);
  const replaced = useMemo(() => closed.filter((row) => !isRemovedByYou(row)), [closed]);
  const closedRows = closedFilter === 'removed' ? removedByYou : replaced;
  const filteredClosedRows = useMemo(
    () => closedRows.filter((row) => matchesClosedSearch(row, closedQuery)),
    [closedRows, closedQuery],
  );
  const addedNumbers = useMemo(
    () => new Set(changes.added.map((row) => row.number)),
    [changes.added],
  );
  const replacedBy = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of decisions) {
      if (row.replacedBy !== null && row.replacedBy > row.number) {
        map.set(row.replacedBy, row.number);
      }
    }
    return map;
  }, [decisions]);

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
  const write = (op: DecisionOp) => {
    void applySessionDecisionOps({ sessionId, ops: [op], actor });
  };
  const jumpTo = (number: number) => {
    const isClosed = closed.some((row) => row.number === number);
    if (isClosed) {
      if (!isClosedOpen) {
        setIsClosedOpen(true);
      }
      setClosedQuery('');
      const row = closed.find((candidate) => candidate.number === number);
      if (row !== undefined) {
        setClosedFilter(isRemovedByYou(row) ? 'removed' : 'replaced');
      }
    }
    window.requestAnimationFrame(() => {
      rows.current.get(number)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    setHighlightMs(HIGHLIGHT_MS);
    setHighlighted(new Set([number]));
  };
  const refFor = (number: number) => (element: HTMLDivElement | null) => {
    if (element === null) {
      rows.current.delete(number);
      return;
    }
    rows.current.set(number, element);
  };
  const removeDecision = (number: number) => {
    write({ kind: 'withdraw', number, reason: null });
    onMarkRemoved(number);
    if (openNumber === number) {
      setOpenNumber(null);
    }
  };
  const undoRemove = (number: number) => {
    write({ kind: 'restore', number });
    onUnmarkRemoved(number);
  };
  const undoAllRemovals = () => {
    const numbers = [...pendingRemovals];
    if (numbers.length === 0) {
      return;
    }
    void applySessionDecisionOps({
      sessionId,
      ops: numbers.map((number) => ({ kind: 'restore' as const, number })),
      actor,
    });
    onClearRemovals();
  };

  const closedFilterOptions: ReadonlyArray<SegmentedTabOption<ClosedFilter>> = [
    { value: 'removed', label: 'Removed by you', badge: String(removedByYou.length) },
    { value: 'replaced', label: 'Replaced', badge: String(replaced.length) },
  ];

  return (
    <div className="flex flex-col gap-3">
      {hasDecisionChanges(changes) ? (
        <DecisionChangesList changes={changes} onJump={jumpTo} />
      ) : null}
      {activeRows.length === 0 ? (
        <EmptyLine className="text-body text-muted-foreground">
          No decisions yet. Agents record one when they settle a choice; you can add your own.
        </EmptyLine>
      ) : (
        <ContextBlock title="Active" icon={CONCEPT_ICONS.decisions} count={active.length}>
          {pendingRemovals.size === 0 ? null : (
            <div className="flex items-center gap-1 px-2 text-meta text-muted-foreground">
              <span>{`${pendingRemovals.size} change${pendingRemovals.size > 1 ? 's' : ''} on this visit`}</span>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={undoAllRemovals}
                className="inline-flex items-center gap-2 rounded-sm px-1 py-0.5 text-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
                  why={row.why}
                  byline={activeDecisionByline({
                    decision: row,
                    agentNames,
                    replaces: replacedBy.get(row.number) ?? null,
                    nowMs,
                  })}
                  isNew={addedNumbers.has(row.number)}
                  reworded={
                    row.previousText !== null &&
                    row.rewordedAt !== null &&
                    (baseline === null ||
                      baseline === undefined ||
                      isAfterBaseline({ iso: row.rewordedAt, baseline }))
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
                  rowRef={refFor(row.number)}
                  onToggleOpen={() =>
                    setOpenNumber((current) => (current === row.number ? null : row.number))
                  }
                  onReword={(text) => write({ kind: 'reword', number: row.number, text })}
                  onRemove={() => removeDecision(row.number)}
                  onUndoRemove={() => undoRemove(row.number)}
                />
              </EnteringRow>
            ))}
          </div>
        </ContextBlock>
      )}
      {closed.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            aria-expanded={isClosedOpen}
            onClick={() => setIsClosedOpen(!isClosedOpen)}
            className="flex items-center gap-2 self-start rounded-md px-2 py-1 text-label text-muted-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
                      rowRef={refFor(row.number)}
                      text={row.text}
                      reason={row.reason}
                      byline={closedDecisionByline({ decision: row, agentNames })}
                      isLocked={isLocked}
                      onJump={jumpTo}
                      onRestore={
                        isRemovedByYou(row)
                          ? () => write({ kind: 'restore', number: row.number })
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
      <AddDecisionRow isLocked={isLocked} onAdd={(text) => write({ kind: 'add', text })} />
    </div>
  );
};
