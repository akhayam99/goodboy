import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';

export type ResolveItemActionId =
  | 'fix_it'
  | 'discuss'
  | 'close'
  | 'resolve'
  | 'change_decision'
  | 'check_publication'
  | 'open_github'
  | 'reopen_locally'
  | 'resume_comment'
  | 'review_changed'
  | 'stop_run'
  | 'view_agent';

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
  readonly sharedApprovalCount: number;
  readonly resolveBlockedReason: string | null;
  readonly closeBlockedReason: string | null;
  readonly hasQuestion: boolean;
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
  sharedApprovalCount,
  resolveBlockedReason,
  closeBlockedReason,
  hasQuestion,
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
  const fixIt = make('fix_it', hasQuestion ? 'Answer the agent' : 'Fix it');
  const discuss = make('discuss', 'Discuss');
  const close = make('close', 'Close', closeBlockedReason);
  const resolve = make(
    'resolve',
    sharedApprovalCount > 1 ? `Resolve ${sharedApprovalCount} comments` : 'Resolve',
    resolveBlockedReason,
  );
  const viewAgent = hasAgent ? make('view_agent', 'View agent') : null;
  const openGithub = make(
    'open_github',
    'Open on GitHub',
    hasGithubUrl ? null : 'GitHub link unavailable',
  );
  const settleOverflow = closeBlockedReason === null ? [discuss, close] : [discuss];
  switch (status) {
    case 'fix_ready':
    case 'reply_ready':
      return { primary: resolve, secondary: fixIt, overflow: settleOverflow };
    case 'no_change':
      return {
        primary: fixIt,
        secondary: discuss,
        overflow: closeBlockedReason === null ? [close] : [],
      };
    case 'agent_asked':
      return { primary: fixIt, secondary: null, overflow: settleOverflow };
    case 'working':
      return {
        primary: viewAgent,
        secondary: null,
        overflow: canStopRun ? [make('stop_run', 'Stop run')] : [],
      };
    case 'ready_to_push':
      return { primary: resolve, secondary: null, overflow: [] };
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
      return { primary: resolve, secondary: openGithub, overflow: [] };
    case 'confirm_delivery':
      return {
        primary: openGithub,
        secondary: make('check_publication', 'Check publication'),
        overflow: [],
      };
    case 'run_failed':
    case 'run_stopped':
      return { primary: fixIt, secondary: viewAgent, overflow: settleOverflow };
    case 'wont_fix':
      return {
        primary: resolve,
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
