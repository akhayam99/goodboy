import type { ReactNode } from 'react';
import { BranchPair, HeaderBand } from '@goodboy/ui';
import type { PullRequestState } from '@goodboy/types';
import { PullRequestChip } from '../../../integrations/github/components/PullRequestChip';

type Props = {
  readonly pr: PullRequestState;
  readonly repo: string | null;
  readonly actions: ReactNode;
};

export const PullRequestHeader = ({ pr, repo, actions }: Props) => (
  <HeaderBand
    title={pr.title}
    meta={
      <>
        <PullRequestChip
          state={pr.isDraft ? 'draft' : pr.state}
          variant="badge"
          number={pr.number}
          iconSize={12}
        />
        <BranchPair headBranch={pr.headBranch} baseBranch={pr.baseBranch} />
        {repo !== null && (
          <span className="min-w-0 truncate font-mono text-secondary text-muted-foreground">
            {repo}
          </span>
        )}
      </>
    }
    actions={actions}
  />
);
