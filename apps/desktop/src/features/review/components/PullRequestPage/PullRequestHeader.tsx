import type { ReactNode } from 'react';
import { BranchPair, HeaderBand } from '@goodboy/ui';
import type { PullRequestState } from '@goodboy/types';
import { PullRequestChip } from '../../../github/components/PullRequestChip';
import { PrSwitcher } from '../../../github/components/PullRequest/PrSwitcher';

type Props = {
  readonly pr: PullRequestState;
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly repo: string | null;
  readonly actions: ReactNode;
  readonly onSelectPr: (prNumber: number) => void;
};

export const PullRequestHeader = ({ pr, prs, repo, actions, onSelectPr }: Props) => (
  <HeaderBand
    title={pr.title}
    meta={
      <>
        {prs.length > 1 ? (
          <PrSwitcher prs={prs} selected={pr.number} onSelect={onSelectPr} />
        ) : (
          <PullRequestChip
            state={pr.isDraft ? 'draft' : pr.state}
            variant="badge"
            number={pr.number}
            iconSize={12}
          />
        )}
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
