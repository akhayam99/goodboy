import type { Session } from '@goodboy/types';
import { Button, EmptyState, ErrorStrip, ICON_SIZE, ListGrid, PageColumn } from '@goodboy/ui';
import { branchWorkArtifactsRegistration } from '../../../artifacts/branchWorkArtifactsRegistration';
import type { BranchWork as Work } from '../../../branch/branchWorkTab';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import type { BranchWorkView } from '../../hooks/useBranchWork';
import { useMarkBranchWorkLeave } from '../../hooks/useMarkBranchWorkLeave';
import { markBranchWorkReturn } from '../../markBranchWorkReturn';
import { openBranchWork } from '../../openBranchWork';
import { RUNS_GRID_COLUMNS } from '../SessionWorkspace/parts/RunsGrid/runsGridColumns';
import { BranchWorkLeads } from './BranchWorkLeads';
import { BranchWorkNotice } from './BranchWorkNotice';
import { BranchWorkQuestions } from './BranchWorkQuestions';
import { BranchWorkRuns } from './BranchWorkRuns';
import { BranchWorkSkeleton } from './BranchWorkSkeleton';

type Props = {
  readonly session: Session;
  readonly work: Work<BranchWorkView>;
};

const ArtifactsSection = branchWorkArtifactsRegistration.Section;

const ArtifactsIcon = CONCEPT_ICONS.artifacts;

const WORK_LABEL = 'Runs on this branch';

export const BranchWork = ({ session, work }: Props) => {
  const sessionId = session.id;
  const { view } = work;
  const { groupKey, mountPath, mounts, runs, leads, story, questions, artifacts } = view;
  const hasLeads = leads.length > 0;
  useMarkBranchWorkLeave({ groupKey, mountPath });

  if (!work.isLoaded) {
    return <BranchWorkSkeleton />;
  }

  const hasQuestionsError = view.hasQuestionsError && !view.isQuestionsLoaded;
  const hasArtifactsError = artifacts.error !== null && !artifacts.isLoaded;
  const isEmpty = runs === null && !hasLeads && questions === null && artifacts.group === null;
  if (groupKey === null || (isEmpty && !hasQuestionsError && !hasArtifactsError)) {
    return (
      <PageColumn width="column" className="flex min-w-0 flex-col pb-5">
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.workflows}
          title="No work on this branch yet"
          description="Runs, questions and artifacts that touch this branch gather on this tab."
        />
      </PageColumn>
    );
  }

  const leave = () => markBranchWorkReturn({ groupKey, mountPath });

  return (
    <PageColumn width="column" className="flex min-w-0 flex-col gap-4 pb-5">
      {story === null ? null : (
        <p data-testid="branch-work-story" className="text-prose text-foreground">
          {story}
        </p>
      )}
      {hasLeads ? (
        <BranchWorkLeads
          sessionId={sessionId}
          leads={leads}
          onToggleFold={view.onToggleLeadFold}
          onLeave={leave}
        />
      ) : null}
      <ListGrid label={WORK_LABEL} columns={RUNS_GRID_COLUMNS} isGrouped>
        {runs === null ? null : (
          <BranchWorkRuns
            session={session}
            group={runs}
            mounts={mounts}
            mountPath={mountPath}
            label={hasLeads ? 'Earlier runs' : NAMES.runs}
            onLeave={leave}
          />
        )}
        {hasQuestionsError ? (
          <BranchWorkNotice>
            <ErrorStrip
              labels={['questions']}
              error={new Error('')}
              onRetry={view.reloadQuestions}
            />
          </BranchWorkNotice>
        ) : questions === null ? null : (
          <BranchWorkQuestions
            sessionId={sessionId}
            group={questions}
            mounts={mounts}
            agents={view.questionAgents}
            mountPath={mountPath}
          />
        )}
        {hasArtifactsError ? (
          <BranchWorkNotice>
            <ErrorStrip
              labels={['artifacts']}
              error={new Error(artifacts.error ?? '')}
              onRetry={artifacts.reload}
            />
          </BranchWorkNotice>
        ) : (
          <ArtifactsSection
            sessionId={sessionId}
            work={artifacts}
            onLeave={leave}
            heading={{
              label: NAMES.artifacts,
              mark: (
                <ArtifactsIcon size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
              ),
              action: (
                <Button
                  variant="quiet"
                  size="xs"
                  onClick={() => openBranchWork({ sessionId, lens: 'plans', groupKey, mountPath })}
                >
                  All artifacts
                </Button>
              ),
            }}
          />
        )}
      </ListGrid>
    </PageColumn>
  );
};
