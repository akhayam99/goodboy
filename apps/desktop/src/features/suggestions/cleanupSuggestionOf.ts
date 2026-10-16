import type { SessionId } from '@goodboy/types';
import { formatBytes } from '../../shared/utils/formatBytes';
import type { SuggestionCleanupProposal } from './deriveNextSteps';
import type { SessionSuggestion } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly proposals: ReadonlyArray<SuggestionCleanupProposal>;
};

type ProposalParams = {
  readonly proposal: SuggestionCleanupProposal;
};

type ProposalsParams = {
  readonly proposals: ReadonlyArray<SuggestionCleanupProposal>;
};

const SEPARATOR = ' · ';

const reasonOf = ({ proposal }: ProposalParams): string => {
  if (proposal.prNumber !== null) {
    return `#${proposal.prNumber} merged`;
  }
  return proposal.isArchived ? 'Session archived' : 'Ready to remove';
};

const sizeOf = ({ proposals }: ProposalsParams): string | null => {
  const sizes = proposals.flatMap((proposal) =>
    proposal.sizeBytes === null ? [] : [proposal.sizeBytes],
  );
  if (sizes.length === 0) {
    return null;
  }
  return formatBytes({ bytes: sizes.reduce((total, size) => total + size, 0) });
};

const titleOf = ({ proposals }: ProposalsParams): string => {
  const [only] = proposals;
  if (proposals.length === 1 && only !== undefined) {
    return `Remove the ${only.projectName} worktree`;
  }
  const isAllMerged = proposals.every((proposal) => proposal.prNumber !== null);
  return `Remove ${proposals.length} ${isAllMerged ? 'merged worktrees' : 'worktrees'}`;
};

const detailOf = ({ proposals }: ProposalsParams): string => {
  const [only] = proposals;
  const reason =
    proposals.length === 1 && only !== undefined
      ? reasonOf({ proposal: only })
      : proposals
          .map((proposal) =>
            proposal.prNumber === null
              ? proposal.projectName
              : `${proposal.projectName} #${proposal.prNumber}`,
          )
          .join(', ');
  const size = sizeOf({ proposals });
  return size === null ? reason : `${reason}${SEPARATOR}${size}`;
};

export const cleanupSuggestionOf = ({ sessionId, proposals }: Params): SessionSuggestion | null => {
  const [first] = proposals;
  if (first === undefined) {
    return null;
  }
  const requestIds = proposals.map((proposal) => proposal.requestId);
  return {
    id: proposals.length === 1 ? `close-worktree:${first.mountId}` : 'close-worktree:group',
    kind: 'close-worktree',
    priority: 51,
    band: 3,
    title: titleOf({ proposals }),
    detail: detailOf({ proposals }),
    sessionId,
    targetKey: proposals.length === 1 ? `worktree:${first.mountId}` : 'worktree:group',
    fingerprint: `close-worktree:${requestIds.join(',')}`,
    payload: {
      worktrees: proposals.map((proposal) => ({
        mountId: proposal.mountId,
        requestId: proposal.requestId,
        branch: proposal.branch,
        prNumber: proposal.prNumber,
      })),
    },
  };
};
