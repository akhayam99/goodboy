import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SkeletonText } from '@goodboy/ui';
import { activeDecisionsNewestFirst, type DecisionOp } from '@goodboy/core';
import type { AgentId, SessionDecision, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AddDecisionRow } from './AddDecisionRow';
import { ClosedDecisionRow } from './ClosedDecisionRow';
import { DecisionRowItem } from './DecisionRowItem';
import { RawDocumentEditor } from './RawDocumentEditor';
import {
  activeDecisionByline,
  closedDecisionByline,
  decisionAge,
  isAfterBaseline,
} from './decisionByline';

const HIGHLIGHT_MS = 1200;
const EMPTY_LEDGER: ReadonlyArray<SessionDecision> = [];

type Props = {
  readonly sessionId: SessionId;
  readonly isLocked: boolean;
  readonly isRawEditing: boolean;
  readonly sourceValue: string;
  readonly onWriteSource: (next: string) => void;
  readonly onCloseRawEditor: () => void;
};

export const DecisionsSection = ({
  sessionId,
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
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    void loadSessionDecisions(sessionId);
  }, [loadSessionDecisions, sessionId]);

  useEffect(() => {
    if (highlighted === null) {
      return;
    }
    const timer = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlighted]);

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

  const nowMs = Date.now();
  const write = (op: DecisionOp) => {
    void applySessionDecisionOps({
      sessionId,
      ops: [op],
      actor: { author: 'user', agentId: null, turnOrdinal: null },
    });
  };
  const jumpTo = (number: number) => {
    rows.current.get(number)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setHighlighted(number);
  };

  return (
    <div className="flex flex-col gap-3">
      {active.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No decisions yet. Agents record one when they settle a choice; you can add your own.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {active.map((row) => (
            <DecisionRowItem
              key={row.id}
              number={row.number}
              text={row.text}
              byline={activeDecisionByline({
                decision: row,
                agentNames,
                replaces: replacedBy.get(row.number) ?? null,
                nowMs,
              })}
              isNew={row.author !== 'user' && isAfterBaseline({ iso: row.createdAt, baseline })}
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
              isHighlighted={highlighted === row.number}
              rowRef={(element) => {
                if (element === null) {
                  rows.current.delete(row.number);
                  return;
                }
                rows.current.set(row.number, element);
              }}
              onReword={(text) => write({ kind: 'reword', number: row.number, text })}
              onWithdraw={() => write({ kind: 'withdraw', number: row.number, reason: null })}
            />
          ))}
        </div>
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
