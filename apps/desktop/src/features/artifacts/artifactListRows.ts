import { parseWireframeSource } from '@goodboy/core';
import type {
  Agent,
  ArtifactId,
  ArtifactKind,
  ArtifactStatus,
  IsoDateTime,
  PlanWithCount,
  SessionArtifact,
} from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import {
  ARTIFACT_GENERATION_PRESENTATION,
  type ArtifactFilter,
  type ArtifactGeneration,
} from './artifactCollection';
import { REPORT_TYPE_LABEL, asReportType } from '../reports/reportTypes';
import {
  planPartRows,
  planPartsProgress,
  planPartsSentence,
  type PlanPartsProgress,
} from '../plans/components/PlanParts/planPartRows';

export type ArtifactRowTone = 'warning' | 'info' | 'danger' | 'neutral';

export type ArtifactRowTarget =
  | Readonly<{ kind: 'artifact'; artifactId: ArtifactId }>
  | Readonly<{ kind: 'generation'; generation: ArtifactGeneration }>;

export type ArtifactRowAction = 'stop' | 'retry';

export type ArtifactListRow = Readonly<{
  key: string;
  target: ArtifactRowTarget;
  kind: ArtifactKind;
  title: string;
  node: WorkNodeState;
  sentence: string;
  sentenceTone: ArtifactRowTone;
  author: string | null;
  revision: number | null;
  at: IsoDateTime | null;
  isFaint: boolean;
  action: ArtifactRowAction | null;
}>;

export type ArtifactListCounts = Readonly<Record<ArtifactFilter, number>>;

type Params = Readonly<{
  plans: ReadonlyArray<PlanWithCount>;
  artifacts: ReadonlyArray<SessionArtifact>;
  generations: ReadonlyArray<ArtifactGeneration>;
  agents: ReadonlyArray<Agent>;
  openQuestionCount: number;
}>;

const isRetired = ({ status }: { readonly status: ArtifactStatus }): boolean =>
  status === 'superseded' || status === 'discarded';

const partsLabel = ({ plan }: { readonly plan: PlanWithCount }): string | null => {
  const count = plan.clusters?.length ?? 0;
  if (count === 0) {
    return null;
  }
  return count === 1 ? '1 part' : `${count} parts`;
};

type PlanState = Pick<ArtifactListRow, 'node' | 'sentence' | 'sentenceTone'>;

const PROGRESS_NODE = {
  notRun: { node: 'done', sentenceTone: 'neutral' },
  running: { node: 'running', sentenceTone: 'info' },
  question: { node: 'question', sentenceTone: 'warning' },
  failed: { node: 'failed', sentenceTone: 'danger' },
  waiting: { node: 'queued', sentenceTone: 'neutral' },
  done: { node: 'done', sentenceTone: 'neutral' },
} as const satisfies Record<
  PlanPartsProgress['kind'],
  Pick<ArtifactListRow, 'node' | 'sentenceTone'>
>;

const ranState = ({
  plan,
  agents,
}: {
  readonly plan: PlanWithCount;
  readonly agents: ReadonlyArray<Agent>;
}): PlanState => {
  const rows = planPartRows({ plan, agents, askingAgentIds: new Set() });
  if (rows.length === 0) {
    return { node: 'done', sentence: 'Ran', sentenceTone: 'neutral' };
  }
  const progress = planPartsProgress({ rows, hasRun: true });
  return { ...PROGRESS_NODE[progress.kind], sentence: planPartsSentence({ progress }) };
};

const planState = ({
  plan,
  agents,
  openQuestionCount,
}: {
  readonly plan: PlanWithCount;
  readonly agents: ReadonlyArray<Agent>;
  readonly openQuestionCount: number;
}): PlanState => {
  switch (plan.status) {
    case 'active': {
      if (openQuestionCount > 0) {
        return { node: 'question', sentence: 'Needs your answer', sentenceTone: 'warning' };
      }
      const parts = partsLabel({ plan });
      return {
        node: 'ready',
        sentence: parts === null ? 'Ready to run' : `Ready to run · ${parts}`,
        sentenceTone: 'warning',
      };
    }
    case 'consumed':
      return ranState({ plan, agents });
    case 'superseded':
      return { node: 'skipped', sentence: 'Replaced by a newer revision', sentenceTone: 'neutral' };
    case 'discarded':
      return { node: 'stopped', sentence: 'Discarded', sentenceTone: 'neutral' };
    default: {
      const exhaustive: never = plan.status;
      return exhaustive;
    }
  }
};

const screensLabel = ({ sourceText }: { readonly sourceText: string }): string => {
  const parsed = parseWireframeSource({ source: sourceText });
  if (parsed.status !== 'valid') {
    return 'Screens could not be read';
  }
  const count = parsed.document.screens.length;
  return count === 1 ? '1 screen' : `${count} screens`;
};

const restingSentence = ({ artifact }: { readonly artifact: SessionArtifact }): string => {
  if (artifact.status === 'superseded') {
    return 'Replaced by a newer revision';
  }
  if (artifact.status === 'discarded') {
    return 'Discarded';
  }
  if (artifact.kind === 'report') {
    const type = asReportType({ value: artifact.metadata.reportType });
    return type === null ? 'Report' : REPORT_TYPE_LABEL[type];
  }
  if (artifact.kind === 'wireframe') {
    return screensLabel({ sourceText: artifact.sourceText });
  }
  return 'Plan';
};

const restingNode = ({ status }: { readonly status: ArtifactStatus }): WorkNodeState => {
  if (status === 'superseded') {
    return 'skipped';
  }
  if (status === 'discarded') {
    return 'stopped';
  }
  return 'marker';
};

const scoutSentence = ({ generation }: { readonly generation: ArtifactGeneration }): string => {
  const total = generation.scouts.length;
  if (total === 0) {
    return 'Writing';
  }
  const done = generation.scouts.filter((scout) => scout.state === 'done').length;
  return `${done} of ${total} scouts done`;
};

const generationRow = ({
  generation,
}: {
  readonly generation: ArtifactGeneration;
}): ArtifactListRow => {
  const base = {
    key: `generation:${generation.agentId}`,
    target: { kind: 'generation', generation },
    kind: generation.kind,
    title: generation.title,
    author: generation.title,
    revision: null,
    at: generation.startedAt,
    isFaint: false,
  } as const satisfies Partial<ArtifactListRow>;
  switch (generation.state) {
    case 'generating':
      return {
        ...base,
        node: 'running',
        sentence: scoutSentence({ generation }),
        sentenceTone: 'info',
        action: generation.canStop ? 'stop' : null,
      };
    case 'waiting':
      return {
        ...base,
        node: 'question',
        sentence: 'Needs your answer',
        sentenceTone: 'warning',
        action: null,
      };
    case 'unproduced':
      return {
        ...base,
        node: 'failed',
        sentence: ARTIFACT_GENERATION_PRESENTATION[generation.kind].unproduced.label,
        sentenceTone: 'danger',
        action: 'retry',
      };
    default: {
      const exhaustive: never = generation.state;
      return exhaustive;
    }
  }
};

const byNewest = (left: ArtifactListRow, right: ArtifactListRow): number =>
  (right.at ?? '').localeCompare(left.at ?? '');

export const buildArtifactListRows = ({
  plans,
  artifacts,
  generations,
  agents,
  openQuestionCount,
}: Params): ReadonlyArray<ArtifactListRow> => {
  const agentName = (agentId: string): string | null =>
    agents.find((agent) => agent.id === agentId)?.name ?? null;
  const revisionOf = (artifactId: ArtifactId): number | null =>
    artifacts.find((artifact) => artifact.id === artifactId)?.revision ?? null;
  const planRows = plans.map((plan): ArtifactListRow => ({
    key: `artifact:${plan.id}`,
    target: { kind: 'artifact', artifactId: plan.id },
    kind: 'plan',
    title: plan.title,
    ...planState({ plan, agents, openQuestionCount }),
    author: agentName(plan.agentId),
    revision: revisionOf(plan.id),
    at: plan.createdAt,
    isFaint: isRetired({ status: plan.status }),
    action: null,
  }));
  const artifactRows = artifacts
    .filter((artifact) => artifact.kind !== 'plan')
    .map((artifact): ArtifactListRow => ({
      key: `artifact:${artifact.id}`,
      target: { kind: 'artifact', artifactId: artifact.id },
      kind: artifact.kind,
      title: artifact.title,
      node: restingNode({ status: artifact.status }),
      sentence: restingSentence({ artifact }),
      sentenceTone: 'neutral',
      author: agentName(artifact.agentId),
      revision: artifact.revision,
      at: artifact.createdAt,
      isFaint: isRetired({ status: artifact.status }),
      action: null,
    }));
  const rows = [
    ...generations.map((generation) => generationRow({ generation })),
    ...planRows,
    ...artifactRows,
  ];
  return [
    ...rows.filter((row) => !row.isFaint).sort(byNewest),
    ...rows.filter((row) => row.isFaint).sort(byNewest),
  ];
};

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
}): ArtifactListCounts => ({
  all: rows.length,
  plan: rows.filter((row) => row.kind === 'plan').length,
  report: rows.filter((row) => row.kind === 'report').length,
  wireframe: rows.filter((row) => row.kind === 'wireframe').length,
});
