import { useEffect, useRef } from 'react';
import type { Agent, AgentId, OpenQuestion, SessionId } from '@goodboy/types';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';
import { TimelineNowRule } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineNowRule';
import { useAgentSpendById } from '../../hooks/useAgentSpendById';
import { RunTreeRow, answerOf, type RunTreeRouting } from './RunTreeRow';
import type { RunTreeModel } from './useRunTree';

type Props = {
  readonly sessionId: SessionId;
  readonly tree: RunTreeModel;
  readonly scrollKey: string;
  readonly label: string;
  readonly testId: string;
  readonly routing: RunTreeRouting;
  readonly selectedAgentId: AgentId | null;
  readonly highlightedStepId?: string | null;
  readonly onHighlight?: (stepId: string | null) => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

type AgentRowItem = TimelineRowItem & { readonly entry: TimelineAgentEntry };

const isAgentRow = (item: TimelineRowItem): item is AgentRowItem => item.entry.kind === 'agent';

const isActive = ({ item }: { readonly item: TimelineRowItem }): boolean =>
  item.rowState.phase === 'running' ||
  item.rowState.phase === 'waiting' ||
  item.rowState.phase === 'failed';

export const RunTreeRows = ({
  sessionId,
  tree,
  scrollKey,
  label,
  testId,
  routing,
  selectedAgentId,
  highlightedStepId = null,
  onHighlight,
  onSelect,
  onAnswer,
}: Props) => {
  const spendByAgentId = useAgentSpendById({ sessionId });
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const scrolledKeyRef = useRef<string | null>(null);
  const { stream, rail } = tree;
  const activeRowId =
    stream.items.find((item): item is TimelineRowItem => item.kind === 'row' && isActive({ item }))
      ?.id ?? null;

  useEffect(() => {
    const element = activeRowRef.current;
    if (element === null || scrolledKeyRef.current === scrollKey) {
      return;
    }
    scrolledKeyRef.current = scrollKey;
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [activeRowId, scrollKey]);

  const hasActionColumn = stream.items.some(
    (item) => item.kind === 'row' && answerOf({ ask: item.rowState.ask }) !== null,
  );
  const agentById = new Map<string, Agent>();
  for (const item of stream.items) {
    if (item.kind === 'row' && isAgentRow(item)) {
      agentById.set(item.entry.agent.id, item.entry.agent);
    }
  }
  const parentOf = ({ entry }: { readonly entry: TimelineAgentEntry }): Agent | null => {
    const parentId = entry.agent.parentAgentId;
    return parentId == null ? null : (agentById.get(parentId) ?? null);
  };
  const parentNameOf = ({ entry }: { readonly entry: TimelineAgentEntry }): string | null => {
    const parent = parentOf({ entry });
    if (parent === null) {
      return null;
    }
    const step = parent.stepId == null ? undefined : routing.stepById.get(parent.stepId);
    return step?.name ?? parent.name;
  };

  return (
    <div className="flex min-w-0 flex-col" aria-label={label} data-testid={testId}>
      {stream.items.map((item, index) => {
        const railRow = rail.rows[index];
        if (railRow === undefined) {
          return null;
        }
        if (item.kind === 'now') {
          return (
            <TimelineNowRule
              key={item.id}
              item={item}
              rail={railRow}
              railWidth={rail.width}
              hasGutter={false}
            />
          );
        }
        if (item.kind !== 'row' || !isAgentRow(item)) {
          return null;
        }
        const isNested = parentOf({ entry: item.entry }) !== null;
        const stepId = isNested ? null : (item.entry.agent.stepId ?? null);
        return (
          <div key={item.id} ref={item.id === activeRowId ? activeRowRef : undefined}>
            <RunTreeRow
              item={item}
              entry={item.entry}
              rail={railRow}
              railWidth={rail.width}
              routing={routing}
              costUsd={spendByAgentId.get(item.entry.agent.id) ?? 0}
              isNested={isNested}
              hasActionColumn={hasActionColumn}
              parentStepName={parentNameOf({ entry: item.entry })}
              isSelected={item.entry.agent.id === selectedAgentId}
              isHighlighted={stepId !== null && stepId === highlightedStepId}
              onHighlight={
                onHighlight === undefined || stepId === null
                  ? undefined
                  : (isOn) => onHighlight(isOn ? stepId : null)
              }
              onSelect={() => onSelect(item.entry.agent.id)}
              onAnswer={onAnswer}
            />
          </div>
        );
      })}
    </div>
  );
};
