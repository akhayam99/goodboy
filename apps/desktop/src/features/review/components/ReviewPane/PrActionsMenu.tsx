import { useState, type ReactNode } from 'react';
import {
  ChevronDown,
  GitMerge,
  GitPullRequestDraft,
  Plus,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { InlineConfirm, OverflowMenu, type ConfirmRole, type OverflowMenuItem } from '@goodboy/ui';
import type { PullRequestState } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PrLifecycleBusy } from '../../prLifecycle';
import type { PrMergeReadiness } from '../../prMergeReadiness';
import { MergeReadinessNote } from './MergeReadinessNote';

type PendingAction = 'merge' | 'ready' | 'close';

type ConfirmSpec = {
  readonly role: ConfirmRole;
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly note?: ReactNode;
  readonly confirmLabel: string;
  readonly isConfirmDisabled: boolean;
  readonly onConfirm: () => void | Promise<void>;
};

type Props = {
  readonly pr: PullRequestState;
  readonly busy: PrLifecycleBusy;
  readonly mergeReadiness: PrMergeReadiness;
  readonly writeInFlight: string | null;
  readonly canCreateNew: boolean;
  readonly onMarkReady: () => void;
  readonly onConvertDraft: () => void;
  readonly onClosePr: () => void;
  readonly onReopen: () => void;
  readonly onMerge: () => Promise<void>;
  readonly onCreateNew: () => void;
};

export const PrActionsMenu = ({
  pr,
  busy,
  mergeReadiness,
  writeInFlight,
  canCreateNew,
  onMarkReady,
  onConvertDraft,
  onClosePr,
  onReopen,
  onMerge,
  onCreateNew,
}: Props) => {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const isTerminal = pr.state === 'merged' || pr.state === 'closed';
  const isClosed = pr.state === 'closed';
  const isQueued = pr.state === 'queued';
  const isBusy = busy !== null || writeInFlight !== null;
  const isMergeBlocked = mergeReadiness.status === 'blocked';

  const confirms: Record<PendingAction, ConfirmSpec> = {
    merge: {
      role: 'danger',
      icon: <GitMerge size={ICON_SIZE.row} aria-hidden />,
      title: `Squash merge #${pr.number}?`,
      description: `Every commit on ${pr.headBranch} lands on ${pr.baseBranch} as one, and GitHub closes the pull request. The branch is not deleted.`,
      note: <MergeReadinessNote readiness={mergeReadiness} />,
      confirmLabel: busy === 'merge' ? 'Merging' : 'Confirm merge',
      isConfirmDisabled: isMergeBlocked || isBusy,
      onConfirm: async () => {
        await onMerge();
        setPending(null);
      },
    },
    ready: {
      role: 'alert',
      icon: <Send size={ICON_SIZE.row} aria-hidden />,
      title: `Mark #${pr.number} ready for review?`,
      description:
        'GitHub takes the pull request out of draft and asks the reviewers the repository assigns. That request cannot be unsent.',
      confirmLabel: busy === 'ready' ? 'Sending' : 'Mark ready',
      isConfirmDisabled: isBusy,
      onConfirm: () => {
        onMarkReady();
        setPending(null);
      },
    },
    close: {
      role: 'danger',
      icon: <XCircle size={ICON_SIZE.row} aria-hidden />,
      title: `Close #${pr.number} without merging?`,
      description:
        'GitHub closes the pull request and drops the review in progress. The branch and its commits stay, and Reopen brings it back.',
      confirmLabel: busy === 'close' ? 'Closing' : 'Close it',
      isConfirmDisabled: isBusy,
      onConfirm: () => {
        onClosePr();
        setPending(null);
      },
    },
  };

  if (pending !== null) {
    const spec = confirms[pending];
    return (
      <InlineConfirm
        role={spec.role}
        icon={spec.icon}
        title={spec.title}
        description={spec.description}
        note={spec.note}
        confirmLabel={spec.confirmLabel}
        onConfirm={spec.onConfirm}
        onCancel={() => setPending(null)}
        isBusy={busy === pending}
        isConfirmDisabled={spec.isConfirmDisabled}
        className="w-72"
      />
    );
  }

  const items: Array<OverflowMenuItem> = [];
  if (!isTerminal && !isQueued) {
    items.push({
      kind: 'item',
      key: 'merge',
      label: 'Merge',
      icon: GitMerge,
      disabled: isMergeBlocked || isBusy,
      hint: writeInFlight ?? mergeReadiness.reason,
      onClick: () => setPending('merge'),
    });
  }
  if (!isTerminal && pr.isDraft) {
    items.push({
      kind: 'item',
      key: 'ready',
      label: 'Mark ready',
      icon: Send,
      disabled: isBusy,
      ...(writeInFlight !== null && { hint: writeInFlight }),
      onClick: () => setPending('ready'),
    });
  }
  if (!isTerminal && !pr.isDraft) {
    items.push({
      kind: 'item',
      key: 'draft',
      label: 'Convert to draft',
      icon: GitPullRequestDraft,
      disabled: isBusy,
      ...(writeInFlight !== null && { hint: writeInFlight }),
      onClick: onConvertDraft,
    });
  }
  if (!isTerminal) {
    items.push({
      kind: 'item',
      key: 'close',
      label: 'Close',
      icon: XCircle,
      destructive: true,
      disabled: isBusy,
      ...(writeInFlight !== null && { hint: writeInFlight }),
      onClick: () => setPending('close'),
    });
  }
  if (isClosed) {
    items.push({
      kind: 'item',
      key: 'reopen',
      label: 'Reopen',
      icon: RotateCcw,
      disabled: isBusy,
      ...(writeInFlight !== null && { hint: writeInFlight }),
      onClick: onReopen,
    });
  }
  items.push({
    kind: 'item',
    key: 'create',
    label: 'Create new PR',
    icon: Plus,
    disabled: canCreateNew === false || isBusy,
    hint: canCreateNew
      ? 'Open a new pull request for this branch'
      : 'An agent is already opening a pull request for this session',
    onClick: onCreateNew,
  });

  return (
    <OverflowMenu
      items={items}
      label="PR actions"
      tooltip="Pull request actions"
      trigger={
        <span className="inline-flex items-center gap-1 text-2xs font-medium">
          PR actions
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0 opacity-70" />
        </span>
      }
      triggerClassName="px-1.5"
    />
  );
};
