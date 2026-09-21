import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';
import type { ResolveProposalKind } from '../../store/slices/resolve/resolveProposalKind';

export type ResolveItemActionId =
  | 'answer_agent'
  | 'approve'
  | 'change_decision'
  | 'check_publication'
  | 'open_github'
  | 'request_revision'
  | 'reopen_locally'
  | 'restart_agent'
  | 'retry_agent'
  | 'review_changed'
  | 'review_publication'
  | 'resume_comment'
  | 'start_agent'
  | 'stop_run'
  | 'view_agent'
  | 'will_not_fix'
  | 'write_reply';

export type ResolveItemAction = {
  readonly id: ResolveItemActionId;
  readonly label: string;
  readonly disabledReason: string | null;
};

export type ResolveItemActionSet = {
  readonly primary: ResolveItemAction | null;
  readonly secondary: ResolveItemAction | null;
  readonly overflow: ReadonlyArray<ResolveItemAction>;
};

type Params = {
  readonly status: ResolveQueueStatus;
  readonly proposalKind: ResolveProposalKind;
  readonly sharedApprovalCount: number;
  readonly approveBlockedReason: string | null;
  readonly refuseBlockedReason: string | null;
  readonly hasAgent: boolean;
  readonly hasGithubUrl: boolean;
  readonly canStopRun: boolean;
  readonly isEditing: boolean;
  readonly isBusy: boolean;
};

type ActionParams = {
  readonly id: ResolveItemActionId;
  readonly label: string;
  readonly blockedReason?: string | null;
  readonly isBusy: boolean;
};

const action = ({ id, label, blockedReason = null, isBusy }: ActionParams): ResolveItemAction => ({
  id,
  label,
  disabledReason: isBusy ? 'Another action is in progress' : blockedReason,
});

const empty = (): ResolveItemActionSet => ({ primary: null, secondary: null, overflow: [] });

export const resolveItemActions = ({
  status,
  proposalKind,
  sharedApprovalCount,
  approveBlockedReason,
  refuseBlockedReason,
  hasAgent,
  hasGithubUrl,
  canStopRun,
  isEditing,
  isBusy,
}: Params): ResolveItemActionSet => {
  if (isEditing) {
    return empty();
  }
  const make = (id: ResolveItemActionId, label: string, blockedReason?: string | null) =>
    action({ id, label, blockedReason, isBusy });
  const refuse = make('will_not_fix', 'Will not fix', refuseBlockedReason);
  const viewAgent = hasAgent ? make('view_agent', 'View agent') : null;
  const openGithub = make(
    'open_github',
    'Open on GitHub',
    hasGithubUrl ? null : 'GitHub link unavailable',
  );
  switch (status) {
    case 'fix_ready': {
      const label =
        sharedApprovalCount > 1 ? `Approve ${sharedApprovalCount} comments` : 'Approve fix';
      return {
        primary: make('approve', label, approveBlockedReason),
        secondary: make('request_revision', 'Request revision'),
        overflow: refuseBlockedReason === null ? [refuse] : [],
      };
    }
    case 'reply_ready':
      return {
        primary: make('approve', 'Approve reply', approveBlockedReason),
        secondary: make('request_revision', 'Request revision'),
        overflow: refuseBlockedReason === null ? [refuse] : [],
      };
    case 'no_change':
      return {
        primary: make('start_agent', 'Start agent'),
        secondary: make('write_reply', 'Write reply'),
        overflow: refuseBlockedReason === null ? [refuse] : [],
      };
    case 'agent_asked':
      return {
        primary: make('answer_agent', 'Answer agent'),
        secondary: null,
        overflow: refuseBlockedReason === null ? [refuse] : [],
      };
    case 'working':
      return {
        primary: viewAgent,
        secondary: null,
        overflow: canStopRun ? [make('stop_run', 'Stop run')] : [],
      };
    case 'ready_to_push':
      return {
        primary: make('review_publication', 'Review publication'),
        secondary: null,
        overflow: [],
      };
    case 'pushed':
      return {
        primary: openGithub,
        secondary: null,
        overflow: [make('reopen_locally', 'Reopen locally')],
      };
    case 'later':
      return { primary: make('resume_comment', 'Resume comment'), secondary: null, overflow: [] };
    case 'changed_since_accepted':
      return {
        primary: make('review_changed', 'Review changed comment'),
        secondary: null,
        overflow: [],
      };
    case 'delivery_failed':
      return {
        primary: make('review_publication', 'Review publication'),
        secondary: openGithub,
        overflow: [],
      };
    case 'confirm_delivery':
      return {
        primary: openGithub,
        secondary: make('check_publication', 'Check publication'),
        overflow: [],
      };
    case 'run_failed':
      return {
        primary: make('retry_agent', 'Retry agent'),
        secondary: viewAgent,
        overflow: refuseBlockedReason === null ? [refuse] : [],
      };
    case 'run_stopped':
      return {
        primary: make('restart_agent', 'Restart agent'),
        secondary: viewAgent,
        overflow: refuseBlockedReason === null ? [refuse] : [],
      };
    case 'wont_fix':
      return {
        primary: make('review_publication', 'Review publication'),
        secondary: make('change_decision', 'Change decision'),
        overflow: [],
      };
    case 'wont_fix_sent':
      return {
        primary: openGithub,
        secondary: null,
        overflow: [make('reopen_locally', 'Reopen locally')],
      };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};
