import { useEffect, useRef, type ReactNode } from 'react';
import type { Agent, AgentId, OpenQuestion, PlanWithCount, SessionId } from '@goodboy/types';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';
import { useAgentSpendById } from '../../hooks/useAgentSpendById';
import type { RowPhase } from '../../../workTreeModel/rowState';
import { railInkAbove, type RailInk } from '../../../workTreeModel/railGeometry';
import { RunTreeFoldRow } from './RunTreeFoldRow';
import { RunTreeRow, type RunTreeRouting } from './RunTreeRow';
import type { RunStepSkipAction } from './RunStepSkip';
import type { RunTreeFolds } from './useFoldedRunTree';
import type { RunTreeModel } from './useRunTree';
import type { RunTreeDensity } from './runTreeDensity';
import type { RunTreeInsert } from '../../runTreeInsert';
import { RUN_TREE_SLOT_WIDTH } from '../../../workTreeModel/runTreeSlotWidth';

type Props = {
  readonly density?: RunTreeDensity;
  readonly sessionId: SessionId;
  readonly tree: RunTreeModel;
  readonly scrollKey: string;
  readonly label: string;
  readonly testId: string;
  readonly routing: RunTreeRouting;
  readonly selectedAgentId: AgentId | null;
  readonly highlightedStepId?: string | null;
  readonly skip?: RunStepSkipAction | null;
  readonly folds?: RunTreeFolds;
  readonly plans?: ReadonlyMap<string, PlanWithCount>;
  readonly waveLabels?: ReadonlyMap<string, string>;
  readonly beforeRow?: (insert: RunTreeInsert) => ReactNode;
  readonly trailing?: (insert: RunTreeInsert) => ReactNode;
  readonly onHighlight?: (stepId: string | null) => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

const LIVE_PHASES: ReadonlySet<RowPhase> = new Set<RowPhase>(['queued', 'running', 'waiting']);

const NO_PLANS: ReadonlyMap<string, PlanWithCount> = new Map();

const NO_WAVE_LABELS: ReadonlyMap<string, string> = new Map();

type AgentRowItem = TimelineRowItem & { readonly entry: TimelineAgentEntry };

const isAgentRow = (item: TimelineRowItem): item is AgentRowItem => item.entry.kind === 'agent';

const isActive = ({ item }: { readonly item: TimelineRowItem }): boolean =>
  item.rowState.phase === 'running' ||
  item.rowState.phase === 'waiting' ||
  item.rowState.phase === 'failed';

export const RunTreeRows = ({
  density = 'page',
  sessionId,
  tree,
  scrollKey,
  label,
  testId,
  routing,
  selectedAgentId,
  highlightedStepId = null,
  skip = null,
  folds,
  plans = NO_PLANS,
  waveLabels = NO_WAVE_LABELS,
  beforeRow,
  trailing,
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

  const isFixed = density !== 'rail';
  const insertSlot = isFixed ? RUN_TREE_SLOT_WIDTH : rail.width;
  const hasActionColumn =
    density === 'page' &&
    stream.items.some(
      (item) =>
        item.kind === 'row' &&
        (LIVE_PHASES.has(item.rowState.phase) ||
          (isAgentRow(item) && plans.has(item.entry.agent.id))),
    );
  const agentById = new Map<string, Agent>();
  for (const item of stream.items) {
    if (item.kind === 'row' && isAgentRow(item)) {
      agentById.set(item.entry.agent.id, item.entry.agent);
    }
  }
  let lastAgentIndex = -1;
  for (const [index, item] of stream.items.entries()) {
    if (item.kind === 'row' && isAgentRow(item)) {
      lastAgentIndex = index;
    }
  }
  const lastItem = stream.items[lastAgentIndex];
  const lastRail = rail.rows[lastAgentIndex];
  const lastInk =
    lastItem === undefined || lastRail === undefined
      ? null
      : railInkAbove({ rail: lastRail, topY: lastItem.topY });
  const trailingInk: RailInk | null =
    lastInk === null || lastItem === undefined
      ? null
      : { ...lastInk, dash: lastItem.isPending ? 'dashed' : 'solid' };
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
        if (item.kind === 'count') {
          if (folds === undefined) {
            return null;
          }
          return (
            <RunTreeFoldRow
              key={item.id}
              item={item}
              rail={railRow}
              railWidth={rail.width}
              isFixed={isFixed}
              onSet={folds.onSet}
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
            {isNested || beforeRow === undefined
              ? null
              : beforeRow({
                  agentId: item.entry.agent.id,
                  slotWidth: insertSlot,
                  ink: railInkAbove({ rail: railRow, topY: item.topY }),
                  hasLineBelow: true,
                })}
            <RunTreeRow
              density={density}
              item={item}
              entry={item.entry}
              rail={railRow}
              railWidth={rail.width}
              routing={routing}
              costUsd={spendByAgentId.get(item.entry.agent.id) ?? 0}
              isNested={isNested}
              hasActionColumn={hasActionColumn}
              plan={plans.get(item.entry.agent.id) ?? null}
              waveLabel={waveLabels.get(item.entry.agent.id) ?? null}
              parentStepName={parentNameOf({ entry: item.entry })}
              isSelected={item.entry.agent.id === selectedAgentId}
              isHighlighted={stepId !== null && stepId === highlightedStepId}
              skip={skip}
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
      {trailing === undefined
        ? null
        : trailing({
            agentId: null,
            slotWidth: insertSlot,
            ink: trailingInk,
            hasLineBelow: false,
          })}
    </div>
  );
};
