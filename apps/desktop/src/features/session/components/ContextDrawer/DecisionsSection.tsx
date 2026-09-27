import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SkeletonText } from '@goodboy/ui';
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

type Props = {
  readonly sessionId: SessionId;
  readonly changes: DecisionChangesSince;
  readonly highlight: ReadonlyArray<number>;
  readonly isLocked: boolean;
  readonly isRawEditing: boolean;
  readonly sourceValue: string;
  readonly onWriteSource: (next: string) => void;
  readonly onCloseRawEditor: () => void;
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
}: Props) => {
  const ledger = useAppStore((state) => state.sessionDecisions[sessionId]);
  const baseline = useAppStore((state) => state.sessionDecisionsBaseline[sessionId]);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId]);
  const loadSessionDecisions = useAppStore((state) => state.loadSessionDecisions);
  const applySessionDecisionOps = useAppStore((state) => state.applySessionDecisionOps);
  const [isClosedOpen, setIsClosedOpen] = useState(false);
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
  useEffect(() => {
    if (highlight.length === 0 || !hasLedger) {
      return;
    }
    const wanted = new Set(highlight);
    const hasClosed = (ledger ?? EMPTY_LEDGER).some(
      (row) => wanted.has(row.number) && row.status !== 'active',
    );
    if (hasClosed) {
      setIsClosedOpen(true);
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
  }, [highlight, hasLedger]);

  const decisions = ledger ?? EMPTY_LEDGER;
  const agentNames = useMemo(
    () => new Map<AgentId, string>((agents ?? []).map((agent) => [agent.id, agent.name])),
    [agents],
  );
  const active = useMemo(() => activeDecisionsNewestFirst({ ledger: decisions }), [decisions]);
  const closed = useMemo(
    () =>
      decisions
        .filter((row) => row.status !== 'active')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [decisions],
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
  const write = (op: DecisionOp) => {
    void applySessionDecisionOps({
      sessionId,
      ops: [op],
      actor: { author: 'user', agentId: null, turnOrdinal: null },
    });
  };
  const jumpTo = (number: number) => {
    const isClosed = decisions.some((row) => row.number === number && row.status !== 'active');
    if (isClosed && !isClosedOpen) {
      setIsClosedOpen(true);
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

  return (
    <div className="flex flex-col gap-3">
      {hasDecisionChanges(changes) ? (
        <DecisionChangesList changes={changes} onJump={jumpTo} />
      ) : null}
      {active.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No decisions yet. Agents record one when they settle a choice; you can add your own.
        </p>
      ) : (
        <ContextBlock title="Active" icon={CONCEPT_ICONS.decisions} count={active.length}>
          <div className="-mx-2 flex flex-col gap-0.5">
            {active.map((row) => (
              <EnteringRow key={row.id} isEntering={!seenAtFirst.has(row.number)}>
                <DecisionRowItem
                  number={row.number}
                  text={row.text}
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
                  rowRef={refFor(row.number)}
                  onReword={(text) => write({ kind: 'reword', number: row.number, text })}
                  onWithdraw={() => write({ kind: 'withdraw', number: row.number, reason: null })}
                />
              </EnteringRow>
            ))}
          </div>
        </ContextBlock>
      )}
      {closed.length === 0 ? null : (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            aria-expanded={isClosedOpen}
            onClick={() => setIsClosedOpen(!isClosedOpen)}
            className="flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-label text-muted-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {isClosedOpen ? (
              <ChevronDown size={ICON_SIZE.row} aria-hidden />
            ) : (
              <ChevronRight size={ICON_SIZE.row} aria-hidden />
            )}
            Replaced and withdrawn
            <span className="text-faint-foreground tabular-nums">{closed.length}</span>
          </button>
          {isClosedOpen
            ? closed.map((row) => (
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
                    row.status === 'withdrawn'
                      ? () => write({ kind: 'restore', number: row.number })
                      : null
                  }
                />
              ))
            : null}
        </div>
      )}
      <AddDecisionRow isLocked={isLocked} onAdd={(text) => write({ kind: 'add', text })} />
    </div>
  );
};
