import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LensEmptyState } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { ArtifactId, PlanId, PlanWithCount } from '@goodboy/types';
import { type ArtifactFilter, type ArtifactGeneration } from '../../artifactCollection';
import type { ArtifactGroup } from '../../artifactGroups';
import { ArtifactGroups } from './ArtifactGroups';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly groups: ReadonlyArray<ArtifactGroup>;
  readonly counts: Readonly<Record<ArtifactFilter, number>>;
  readonly openQuestionCount: number;
  readonly filter: ArtifactFilter;
  readonly eyebrow?: ReactNode;
  readonly onFilterChange: (filter: ArtifactFilter) => void;
  readonly onSelectPlan: (planId: PlanId) => void;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
  readonly onSelectGeneration: (generation: ArtifactGeneration) => void;
  readonly onStopGeneration: (generation: ArtifactGeneration) => void;
  readonly onRetryGeneration: (generation: ArtifactGeneration) => void;
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
  groups,
  counts,
  openQuestionCount,
  filter,
  eyebrow,
  onFilterChange,
  onSelectPlan,
  onSelectArtifact,
  onSelectGeneration,
  onStopGeneration,
  onRetryGeneration,
}: Props) => {
  const empty = EMPTY_COPY[filter];

  return (
    <PaneShell
      title="Artifacts"
      description="Plans, reports and wireframes this session produced. Select one to read it."
      meta={counts.all > 0 ? counts.all : undefined}
      eyebrow={eyebrow}
    >
      <ArtifactGroups
        plans={plans}
        groups={groups}
        counts={counts}
        filter={filter}
        openQuestionCount={openQuestionCount}
        selectedArtifactId={null}
        selectedGenerationAgentId={null}
        isCompact={false}
        empty={
          <LensEmptyState
            tone={empty.tone}
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
          />
        }
        onFilterChange={onFilterChange}
        onSelectPlan={onSelectPlan}
        onSelectArtifact={onSelectArtifact}
        onSelectGeneration={onSelectGeneration}
        onStopGeneration={onStopGeneration}
        onRetryGeneration={onRetryGeneration}
      />
    </PaneShell>
  );
};
