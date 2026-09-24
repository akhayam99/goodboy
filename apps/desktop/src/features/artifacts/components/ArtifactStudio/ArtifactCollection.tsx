import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LensEmptyState } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { ArtifactId, PlanId, PlanWithCount, SessionId } from '@goodboy/types';
import { type ArtifactFilter, type ArtifactGeneration } from '../../artifactCollection';
import type { ArtifactGroup } from '../../artifactGroups';
import { ArtifactGroups } from './ArtifactGroups';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { CreateReportCta } from '../../../reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../wireframes/components/CreateWireframeCta';

type Props = {
  readonly sessionId: SessionId;
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
      'Plans, reports and wireframes made in this session collect here. Agents write plans as they work. Start a report or a wireframe yourself.',
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
    description: 'A report writes up what this session has done so far.',
    icon: CONCEPT_ICONS.sessionSummary,
    tone: CONCEPT_TONE.sessionSummary,
  },
  wireframe: {
    title: 'No wireframes yet',
    description: 'A wireframe draws the screen or flow you describe.',
    icon: CONCEPT_ICONS.workflowPreset,
    tone: CONCEPT_TONE.workflowPreset,
  },
};

export const ArtifactCollection = ({
  sessionId,
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
  const reportCta = <CreateReportCta sessionId={sessionId} />;
  const wireframeCta = <CreateWireframeCta sessionId={sessionId} />;
  const emptyAction =
    filter === 'report' ? reportCta : filter === 'wireframe' ? wireframeCta : null;

  return (
    <PaneShell
      title="Artifacts"
      description="Plans, reports and wireframes this session produced. Select one to read it."
      meta={counts.all > 0 ? counts.all : undefined}
      eyebrow={eyebrow}
      actions={
        <>
          {reportCta}
          {wireframeCta}
        </>
      }
    >
      <ArtifactGroups
        plans={plans}
        groups={groups}
        counts={counts}
        filter={filter}
        openQuestionCount={openQuestionCount}
        empty={
          <LensEmptyState
            tone={empty.tone}
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
            {...(emptyAction !== null && { action: emptyAction })}
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
