import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LensEmptyState } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { AgentId, ArtifactId, PlanId, PlanWithCount, SessionArtifact } from '@goodboy/types';
import {
  ARTIFACT_FILTER_LABEL,
  GENERATED_ARTIFACT_KINDS,
  type ArtifactFilter,
  type ArtifactGeneration,
  type GeneratedArtifactKind,
} from '../../artifactCollection';
import { ArtifactFilterTabs } from './ArtifactFilterTabs';
import { ArtifactKindRows } from './ArtifactKindRows';
import { ArtifactSection } from './ArtifactSection';
import { PlanList } from '../../../plans/components/PlanStudio/PlanList';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly generations: ReadonlyArray<ArtifactGeneration>;
  readonly openQuestionCount: number;
  readonly filter: ArtifactFilter;
  readonly eyebrow?: ReactNode;
  readonly onFilterChange: (filter: ArtifactFilter) => void;
  readonly onSelectPlan: (planId: PlanId) => void;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
  readonly onSelectGeneration: (agentId: AgentId) => void;
};

type EmptyCopy = {
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly tone: Tone;
};

const EMPTY_COPY: Record<ArtifactFilter, EmptyCopy> = {
  all: {
    title: 'No artifacts yet',
    description:
      'Plans, reports and wireframes made in this session collect here. Agents write plans as they work, reports and wireframes you ask for yourself.',
    icon: CONCEPT_ICONS.plans,
    tone: CONCEPT_TONE.plans,
  },
  plan: {
    title: 'No plans yet',
    description: 'Plans appear here once an agent drafts one. Run a planning agent to get started.',
    icon: CONCEPT_ICONS.plans,
    tone: CONCEPT_TONE.plans,
  },
  report: {
    title: 'No reports yet',
    description: 'Create report writes up what this session has actually done so far.',
    icon: CONCEPT_ICONS.sessionSummary,
    tone: CONCEPT_TONE.sessionSummary,
  },
  wireframe: {
    title: 'No wireframes yet',
    description: 'Create wireframe draws the screen or flow you describe.',
    icon: CONCEPT_ICONS.workflowPreset,
    tone: CONCEPT_TONE.workflowPreset,
  },
};

export const ArtifactCollection = ({
  plans,
  artifacts,
  generations,
  openQuestionCount,
  filter,
  eyebrow,
  onFilterChange,
  onSelectPlan,
  onSelectArtifact,
  onSelectGeneration,
}: Props) => {
  const byKind = GENERATED_ARTIFACT_KINDS.map((kind) => ({
    kind,
    artifacts: artifacts.filter((artifact) => artifact.kind === kind),
    generations: generations.filter((generation) => generation.kind === kind),
  }));
  const countOf = (kind: GeneratedArtifactKind): number => {
    const group = byKind.find((entry) => entry.kind === kind);
    return group === undefined ? 0 : group.artifacts.length + group.generations.length;
  };
  const counts: Record<ArtifactFilter, number> = {
    plan: plans.length,
    report: countOf('report'),
    wireframe: countOf('wireframe'),
    all: plans.length + countOf('report') + countOf('wireframe'),
  };
  const isShown = (kind: ArtifactFilter): boolean =>
    (filter === 'all' || filter === kind) && counts[kind] > 0;
  const empty = EMPTY_COPY[filter];

  return (
    <PaneShell
      title="Artifacts"
      description="Plans, reports and wireframes this session produced. Select one to read it."
      meta={counts.all > 0 ? counts.all : undefined}
      eyebrow={eyebrow}
    >
      <ArtifactFilterTabs value={filter} counts={counts} onChange={onFilterChange} />
      {counts[filter] === 0 ? (
        <LensEmptyState
          tone={empty.tone}
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
        />
      ) : null}
      {isShown('plan') ? (
        <ArtifactSection heading={ARTIFACT_FILTER_LABEL.plan}>
          <PlanList plans={plans} openQuestionCount={openQuestionCount} onSelect={onSelectPlan} />
        </ArtifactSection>
      ) : null}
      {byKind.map((group) =>
        isShown(group.kind) ? (
          <ArtifactSection key={group.kind} heading={ARTIFACT_FILTER_LABEL[group.kind]}>
            <ArtifactKindRows
              artifacts={group.artifacts}
              generations={group.generations}
              onSelectArtifact={onSelectArtifact}
              onSelectGeneration={onSelectGeneration}
            />
          </ArtifactSection>
        ) : null,
      )}
    </PaneShell>
  );
};
