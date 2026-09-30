import { ChevronRight } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly branch: string | null;
  readonly canOpenPullRequest: boolean;
  readonly isDraftAgentRunning: boolean;
  readonly onOpenPullRequest: () => void;
};

const NO_PULL_REQUEST = 'No pull request yet, your notes stay on this machine';
const OPEN_PULL_REQUEST = 'Open a pull request';
const FOLLOW_DRAFTING_AGENT = 'Follow the drafting agent';

export const NoPullRequestLine = ({
  branch,
  canOpenPullRequest,
  isDraftAgentRunning,
  onOpenPullRequest,
}: Props) => (
  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-secondary text-muted-foreground">
    {branch !== null && <span className="min-w-0 truncate font-mono">{branch}</span>}
    <span>{NO_PULL_REQUEST}</span>
    {canOpenPullRequest && (
      <button
        type="button"
        onClick={onOpenPullRequest}
        className="inline-flex items-center gap-0.5 rounded-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {isDraftAgentRunning ? FOLLOW_DRAFTING_AGENT : OPEN_PULL_REQUEST}
        <ChevronRight size={ICON_SIZE.row} aria-hidden />
      </button>
    )}
  </p>
);
