import { Divider, PANE_RHYTHM, ScrollFade, cn } from '@goodboy/ui';
import type { AgentId, ArtifactId, PlanId, PlanWithCount } from '@goodboy/types';
import { type ArtifactFilter, type ArtifactGeneration } from '../../artifactCollection';
import type { ArtifactGroup } from '../../artifactGroups';
import { ArtifactGroups } from './ArtifactGroups';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly groups: ReadonlyArray<ArtifactGroup>;
  readonly counts: Readonly<Record<ArtifactFilter, number>>;
  readonly openQuestionCount: number;
  readonly filter: ArtifactFilter;
  readonly selectedArtifactId: ArtifactId | null;
  readonly selectedGenerationAgentId: AgentId | null;
  readonly onFilterChange: (filter: ArtifactFilter) => void;
  readonly onSelectPlan: (planId: PlanId) => void;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
  readonly onSelectGeneration: (generation: ArtifactGeneration) => void;
  readonly onStopGeneration: (generation: ArtifactGeneration) => void;
  readonly onRetryGeneration: (generation: ArtifactGeneration) => void;
};

export const ArtifactRail = ({
  plans,
  groups,
  counts,
  openQuestionCount,
  filter,
  selectedArtifactId,
  selectedGenerationAgentId,
  onFilterChange,
  onSelectPlan,
  onSelectArtifact,
  onSelectGeneration,
  onStopGeneration,
  onRetryGeneration,
}: Props) => (
  <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
    <div className={cn('flex shrink-0 items-baseline gap-2', PANE_RHYTHM.rail.header)}>
      <h1 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
        Artifacts
      </h1>
      {counts.all > 0 ? (
        <span className="text-2xs tabular-nums text-muted-foreground/70">{counts.all}</span>
      ) : null}
    </div>
    <Divider />
    <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.rail.body} fadeSize={24}>
      <div data-testid="artifact-rail" className="flex min-w-0 flex-col gap-3">
        <ArtifactGroups
          plans={plans}
          groups={groups}
          counts={counts}
          filter={filter}
          openQuestionCount={openQuestionCount}
          selectedArtifactId={selectedArtifactId}
          selectedGenerationAgentId={selectedGenerationAgentId}
          isCompact
          empty={
            <p className="text-2xs text-muted-foreground">
              nothing of this kind in this session yet
            </p>
          }
          onFilterChange={onFilterChange}
          onSelectPlan={onSelectPlan}
          onSelectArtifact={onSelectArtifact}
          onSelectGeneration={onSelectGeneration}
          onStopGeneration={onStopGeneration}
          onRetryGeneration={onRetryGeneration}
        />
      </div>
    </ScrollFade>
  </div>
);
