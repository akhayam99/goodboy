import type {
  Agent,
  AgentId,
  ArtifactId,
  ArtifactKind,
  IsoDateTime,
  PlanWithCount,
  SessionArtifact,
} from '@goodboy/types';
import type { ArtifactFilter, ArtifactGeneration } from './artifactCollection';
import {
  artifactStateOf,
  generationStateOf,
  type ArtifactGroup,
  type ArtifactState,
} from './artifactStateOf';
import { planConsumerLabel, resolvePlanConsumer } from '../../shared/utils/planConsumer';
import type { WorkNodeState } from '@goodboy/ui';
import { planPartRows } from '../plans/components/PlanParts/planPartRows';
import { NO_PLAN_STATE_INPUTS, planStateInputsOf } from '../plans/planStateInputs';

type ArtifactRowTarget =
  | Readonly<{ kind: 'artifact'; artifactId: ArtifactId }>
  | Readonly<{ kind: 'generation'; generation: ArtifactGeneration }>;

export type ArtifactRowPart = Readonly<{
  index: number;
  title: string;
  nodeState: WorkNodeState;
  nodeLabel: string;
}>;

export type ArtifactListRow = Readonly<{
  id: string;
  target: ArtifactRowTarget;
  kind: ArtifactKind;
  title: string;
  state: ArtifactState | null;
  group: ArtifactGroup;
  at: IsoDateTime | null;
  deletedAt: IsoDateTime | null;
  partCount: number;
  parts: ReadonlyArray<ArtifactRowPart>;
  runBy: string | null;
  isPlanRunning: boolean;
  isFaint: boolean;
}>;

export type ArtifactListCounts = Readonly<Record<ArtifactFilter, number>>;

type Params = Readonly<{
  plans: ReadonlyArray<PlanWithCount>;
  artifacts: ReadonlyArray<SessionArtifact>;
  generations: ReadonlyArray<ArtifactGeneration>;
  agents: ReadonlyArray<Agent>;
  openQuestionCount: number;
  askingAgentIds: ReadonlySet<AgentId>;
}>;

const runByOf = ({
  plan,
  agents,
}: {
  readonly plan: PlanWithCount;
  readonly agents: ReadonlyArray<Agent>;
}): string | null => {
  const last = plan.lastConsumer ?? null;
  if (last === null || plan.consumptionCount === 0) {
    return null;
  }
  const consumer = resolvePlanConsumer({ agentId: last.agentId, agentName: last.name, agents });
  return planConsumerLabel({ name: consumer.name, count: plan.consumptionCount });
};

const groupOf = ({ state }: { readonly state: ArtifactState | null }): ArtifactGroup =>
  state === null ? 'ready' : state.group;

const generationRow = ({
  generation,
}: {
  readonly generation: ArtifactGeneration;
}): ArtifactListRow => {
  const state = generationStateOf({ generation });
  return {
    id: `generation:${generation.agentId}`,
    target: { kind: 'generation', generation },
    kind: generation.kind,
    title: generation.title,
    state,
    group: state.group,
    at: generation.startedAt,
    deletedAt: null,
    partCount: 0,
    parts: [],
    runBy: null,
    isPlanRunning: false,
    isFaint: false,
  };
};

const planRow = ({
  plan,
  agents,
  openQuestionCount,
  askingAgentIds,
}: {
  readonly plan: PlanWithCount;
  readonly agents: ReadonlyArray<Agent>;
  readonly openQuestionCount: number;
  readonly askingAgentIds: ReadonlySet<AgentId>;
}): ArtifactListRow => {
  const partRows = planPartRows({ plan, agents, askingAgentIds });
  const inputs = planStateInputsOf({ plan, rows: partRows });
  const state = artifactStateOf({
    kind: 'plan',
    status: plan.status,
    isOpened: true,
    openQuestionCount,
    ...inputs,
  });
  return {
    id: `artifact:${plan.id}`,
    target: { kind: 'artifact', artifactId: plan.id },
    kind: 'plan',
    title: plan.title,
    state,
    group: groupOf({ state }),
    at: plan.createdAt,
    deletedAt: plan.status === 'discarded' ? plan.updatedAt : null,
    partCount: inputs.partCount,
    parts: partRows.map((part) => ({
      index: part.index,
      title: part.title,
      nodeState: part.node.state,
      nodeLabel: part.node.label,
    })),
    runBy: runByOf({ plan, agents }),
    isPlanRunning: state?.key === 'running' || state?.key === 'needs',
    isFaint: state?.key === 'deleted' || state?.key === 'replaced',
  };
};

const documentRow = ({ artifact }: { readonly artifact: SessionArtifact }): ArtifactListRow => {
  const state = artifactStateOf({
    kind: artifact.kind,
    status: artifact.status,
    isOpened: artifact.openedAt !== null,
    openQuestionCount: 0,
    ...NO_PLAN_STATE_INPUTS,
  });
  return {
    id: `artifact:${artifact.id}`,
    target: { kind: 'artifact', artifactId: artifact.id },
    kind: artifact.kind,
    title: artifact.title,
    state,
    group: groupOf({ state }),
    at: artifact.createdAt,
    deletedAt: artifact.status === 'discarded' ? artifact.updatedAt : null,
    partCount: 0,
    parts: [],
    runBy: null,
    isPlanRunning: false,
    isFaint: state?.key === 'deleted' || state?.key === 'replaced',
  };
};

const sortKey = (row: ArtifactListRow): string => row.deletedAt ?? row.at ?? '';

const byNewest = (left: ArtifactListRow, right: ArtifactListRow): number =>
  sortKey(right).localeCompare(sortKey(left));

export const buildArtifactListRows = ({
  plans,
  artifacts,
  generations,
  agents,
  openQuestionCount,
  askingAgentIds,
}: Params): ReadonlyArray<ArtifactListRow> =>
  [
    ...generations.map((generation) => generationRow({ generation })),
    ...plans.map((plan) => planRow({ plan, agents, openQuestionCount, askingAgentIds })),
    ...artifacts
      .filter((artifact) => artifact.kind !== 'plan')
      .map((artifact) => documentRow({ artifact })),
  ].sort(byNewest);

const ARTIFACT_GROUP_ORDER: ReadonlyArray<ArtifactGroup> = [
  'needs',
  'ready',
  'running',
  'ran',
  'deleted',
];

export const ARTIFACT_GROUP_LABEL: Readonly<Record<ArtifactGroup, string>> = {
  needs: 'Needs you',
  ready: 'Ready',
  running: 'Running',
  ran: 'Ran',
  deleted: 'Recently deleted',
};

export const groupArtifactRows = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ArtifactListRow>;
}): ReadonlyArray<Readonly<{ group: ArtifactGroup; rows: ReadonlyArray<ArtifactListRow> }>> =>
  ARTIFACT_GROUP_ORDER.map((group) => ({
    group,
    rows: rows.filter((row) => row.group === group),
  })).filter((entry) => entry.rows.length > 0);

export const filterArtifactRows = ({
  rows,
  filter,
}: {
  readonly rows: ReadonlyArray<ArtifactListRow>;
  readonly filter: ArtifactFilter;
}): ReadonlyArray<ArtifactListRow> =>
  filter === 'all' ? rows : rows.filter((row) => row.kind === filter);

export const countArtifactRows = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ArtifactListRow>;
}): ArtifactListCounts => {
  const live = rows.filter((row) => row.group !== 'deleted');
  return {
    all: live.length,
    plan: live.filter((row) => row.kind === 'plan').length,
    report: live.filter((row) => row.kind === 'report').length,
    wireframe: live.filter((row) => row.kind === 'wireframe').length,
  };
};
