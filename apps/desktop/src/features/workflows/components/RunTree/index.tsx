import { useEffect, useRef } from 'react';
import type { Agent, AgentId, OpenQuestion, Session, Workflow, WorkflowRun } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';
import { TimelineNowRule } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineNowRule';
import { RunTreeRow, type RunTreeRouting } from './RunTreeRow';
import { useRunTree } from './useRunTree';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly routing: RunTreeRouting;
  readonly selectedAgentId: AgentId | null;
  readonly onSelect: (id: AgentId) => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

type AgentRowItem = TimelineRowItem & { readonly entry: TimelineAgentEntry };

const isAgentRow = (item: TimelineRowItem): item is AgentRowItem => item.entry.kind === 'agent';

const isActive = ({ item }: { readonly item: TimelineRowItem }): boolean =>
  item.rowState.phase === 'running' ||
  item.rowState.phase === 'waiting' ||
  item.rowState.phase === 'failed';

export const RunTree = ({
  session,
  run,
  workflow,
  agentKindOverride,
  routing,
  selectedAgentId,
  onSelect,
  onAnswer,
}: Props) => {
  const tree = useRunTree({ session, run, workflow, agentKindOverride });
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const scrolledRunIdRef = useRef<string | null>(null);
  const activeRowId =
    tree?.stream.items.find(
      (item): item is TimelineRowItem => item.kind === 'row' && isActive({ item }),
    )?.id ?? null;

  useEffect(() => {
    const element = activeRowRef.current;
    if (element === null || scrolledRunIdRef.current === run.id) {
      return;
    }
    scrolledRunIdRef.current = run.id;
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [activeRowId, run.id]);

  if (tree === null) {
    return null;
  }
  const { stream, rail } = tree;
  const agentById = new Map<string, Agent>();
  for (const item of stream.items) {
    if (item.kind === 'row' && isAgentRow(item)) {
      agentById.set(item.entry.agent.id, item.entry.agent);
    }
  }
  const parentNameOf = ({ entry }: { readonly entry: TimelineAgentEntry }): string | null => {
    const parentId = entry.agent.parentAgentId;
    const parent = parentId == null ? undefined : agentById.get(parentId);
    if (parent === undefined) {
      return null;
    }
    const step = parent.stepId == null ? undefined : routing.stepById.get(parent.stepId);
    return step?.name ?? parent.name;
  };

  return (
    <div className="flex min-w-0 flex-col" aria-label="Workflow steps" data-testid="run-tree">
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
        return (
          <div key={item.id} ref={item.id === activeRowId ? activeRowRef : undefined}>
            <RunTreeRow
              item={item}
              entry={item.entry}
              rail={railRow}
              railWidth={rail.width}
              routing={routing}
              parentStepName={parentNameOf({ entry: item.entry })}
              isSelected={item.entry.agent.id === selectedAgentId}
              onSelect={() => onSelect(item.entry.agent.id)}
              onAnswer={onAnswer}
            />
          </div>
        );
      })}
    </div>
  );
};
