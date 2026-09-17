import type { ReactNode } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { AgentId, ArtifactId, PlanId, PlanWithCount } from '@goodboy/types';
import {
  ARTIFACT_FILTER_LABEL,
  type ArtifactFilter,
  type ArtifactGeneration,
} from '../../artifactCollection';
import { isArtifactSectionShown, type ArtifactGroup } from '../../artifactGroups';
import { ArtifactFilterTabs } from './ArtifactFilterTabs';
import { ArtifactKindRows } from './ArtifactKindRows';
import { ArtifactSection } from './ArtifactSection';
import { PlanList } from '../../../plans/components/PlanStudio/PlanList';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly groups: ReadonlyArray<ArtifactGroup>;
  readonly counts: Readonly<Record<ArtifactFilter, number>>;
  readonly filter: ArtifactFilter;
  readonly openQuestionCount: number;
  readonly selectedArtifactId: ArtifactId | null;
  readonly selectedGenerationAgentId: AgentId | null;
  readonly isCompact: boolean;
  readonly empty: ReactNode;
  readonly onFilterChange: (filter: ArtifactFilter) => void;
  readonly onSelectPlan: (planId: PlanId) => void;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
  readonly onSelectGeneration: (generation: ArtifactGeneration) => void;
  readonly onStopGeneration: (generation: ArtifactGeneration) => void;
  readonly onRetryGeneration: (generation: ArtifactGeneration) => void;
};

export const ArtifactGroups = ({
  plans,
  groups,
  counts,
  filter,
  openQuestionCount,
  selectedArtifactId,
  selectedGenerationAgentId,
  isCompact,
  empty,
  onFilterChange,
  onSelectPlan,
  onSelectArtifact,
  onSelectGeneration,
  onStopGeneration,
  onRetryGeneration,
}: Props) => (
  <>
    <ScrollFade orientation="horizontal" fadeSize={16} className="min-w-0 shrink-0">
      <ArtifactFilterTabs value={filter} counts={counts} onChange={onFilterChange} />
    </ScrollFade>
    {counts[filter] === 0 ? empty : null}
    {isArtifactSectionShown({ filter, kind: 'plan', counts }) ? (
      <ArtifactSection heading={ARTIFACT_FILTER_LABEL.plan}>
        <PlanList
          plans={plans}
          openQuestionCount={openQuestionCount}
          {...(isCompact && { visibleFinishedCount: 0 })}
          onSelect={onSelectPlan}
        />
      </ArtifactSection>
    ) : null}
    {groups.map((group) =>
      isArtifactSectionShown({ filter, kind: group.kind, counts }) ? (
        <ArtifactSection key={group.kind} heading={ARTIFACT_FILTER_LABEL[group.kind]}>
          <ArtifactKindRows
            artifacts={group.artifacts}
            generations={group.generations}
            selectedArtifactId={selectedArtifactId}
            selectedGenerationAgentId={selectedGenerationAgentId}
            isCompact={isCompact}
            onSelectArtifact={onSelectArtifact}
            onSelectGeneration={onSelectGeneration}
            onStopGeneration={onStopGeneration}
            onRetryGeneration={onRetryGeneration}
          />
        </ArtifactSection>
      ) : null,
    )}
  </>
);
