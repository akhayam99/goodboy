import type { Agent, ProjectId } from '@goodboy/types';
import type { TranscriptMountProposal } from '../../../../suggestions/transcriptMountProposals';
import { MountSuggestionCard } from '../../MountSuggestionCard';

type ProposalTarget = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly reason: string;
};

type Actions = {
  readonly mount: (target: ProposalTarget) => Promise<void>;
  readonly dismiss: (target: ProposalTarget) => void;
};

type Props = {
  readonly proposals: ReadonlyArray<TranscriptMountProposal>;
  readonly phaseRuns: ReadonlyArray<Agent>;
  readonly actions: Actions;
};

export const MountSuggestionStack = ({ proposals, phaseRuns, actions }: Props) => (
  <div className="flex min-w-0 flex-col gap-2">
    {proposals.map((proposal) => (
      <MountSuggestionCard
        key={proposal.projectId}
        projectName={proposal.projectName}
        agentName={
          phaseRuns.find((run) => run.id === proposal.agentId)?.name ?? 'the requesting agent'
        }
        reason={proposal.reason}
        cause={proposal.cause}
        onMount={() =>
          actions.mount({
            projectId: proposal.projectId,
            projectName: proposal.projectName,
            reason: proposal.reason,
          })
        }
        onDismiss={() =>
          actions.dismiss({
            projectId: proposal.projectId,
            projectName: proposal.projectName,
            reason: proposal.reason,
          })
        }
      />
    ))}
  </div>
);
