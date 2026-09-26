import { BranchPair, Button, HeaderBand } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly branch: string | null;
  readonly baseBranch: string | null;
  readonly canOpenPullRequest: boolean;
  readonly isDraftAgentRunning: boolean;
  readonly onOpenPullRequest: () => void;
};

export const NO_PULL_REQUEST = 'No pull request';
export const OPEN_PULL_REQUEST = 'Open pull request';
export const FOLLOW_DRAFTING_AGENT = 'Follow the drafting agent';

export const NoPullRequestHeader = ({
  title,
  branch,
  baseBranch,
  canOpenPullRequest,
  isDraftAgentRunning,
  onOpenPullRequest,
}: Props) => (
  <HeaderBand
    title={title}
    meta={
      <>
        {branch !== null &&
          (baseBranch === null ? (
            <span className="min-w-0 truncate font-mono text-secondary text-muted-foreground">
              {branch}
            </span>
          ) : (
            <BranchPair headBranch={branch} baseBranch={baseBranch} />
          ))}
        <span className="shrink-0 text-secondary text-muted-foreground">{NO_PULL_REQUEST}</span>
      </>
    }
    actions={
      canOpenPullRequest ? (
        <Button size="sm" variant="secondary" onClick={onOpenPullRequest}>
          {isDraftAgentRunning ? FOLLOW_DRAFTING_AGENT : OPEN_PULL_REQUEST}
        </Button>
      ) : null
    }
  />
);
