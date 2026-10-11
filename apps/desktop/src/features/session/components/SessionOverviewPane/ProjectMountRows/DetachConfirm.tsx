import type { ReactNode } from 'react';
import { ConfirmPopover, Skeleton, type ConfirmPopoverTriggerParams } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { DetachDetails } from './DetachDetails';
import { CHECKING_STATUS, detachActionFor, type DetachPlan } from './detachPlan';
import type { DetachDisposition } from '../../../../../store/slices/project-mounts/detachProject';

type Props = {
  readonly projectName: string;
  readonly plan: DetachPlan;
  readonly isOpen: boolean;
  readonly trigger: (params: ConfirmPopoverTriggerParams) => ReactNode;
  readonly isBusy: boolean;
  readonly stage: string | null;
  readonly onConfirm: (input: { readonly disposition: DetachDisposition }) => void;
  readonly onRecheck: () => void;
  readonly onCancel: () => void;
};

const AlertIcon = CONCEPT_ICONS.errors;
const WorktreeIcon = CONCEPT_ICONS.worktree;

export const DetachConfirm = ({
  projectName,
  plan,
  isOpen,
  trigger,
  isBusy,
  stage,
  onConfirm,
  onRecheck,
  onCancel,
}: Props) => {
  const title = `Remove ${projectName} from the session?`;

  if (plan.kind === 'checking') {
    return (
      <ConfirmPopover
        width="w-96"
        isOpen={isOpen}
        trigger={trigger}
        role="primary"
        icon={<WorktreeIcon size={ICON_SIZE.row} />}
        title={title}
        confirmLabel="Remove"
        isConfirmDisabled
        onConfirm={() => undefined}
        onCancel={onCancel}
      >
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <span className="text-meta text-muted-foreground">{CHECKING_STATUS}</span>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </ConfirmPopover>
    );
  }

  const action = detachActionFor({ plan });
  if (action === null) {
    return (
      <ConfirmPopover
        width="w-96"
        isOpen={isOpen}
        trigger={trigger}
        role="alert"
        icon={<AlertIcon size={ICON_SIZE.row} />}
        title={title}
        confirmLabel="Remove"
        isConfirmDisabled
        onConfirm={() => undefined}
        onCancel={onCancel}
      >
        <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
          {plan.lines.map((line) => (
            <p key={line} className="break-words">
              {line}
            </p>
          ))}
        </div>
      </ConfirmPopover>
    );
  }
  const isRisky = plan.kind === 'risky';
  const details =
    plan.kind === 'risky' || plan.kind === 'keep' || plan.kind === 'safe'
      ? plan.details
      : { totals: [], worktrees: [] };
  const hasDetails = details.totals.length > 0 || details.worktrees.length > 0;
  const isUnread =
    plan.kind === 'keep' && (plan.reason === 'unavailable' || plan.reason === 'unverified');

  return (
    <ConfirmPopover
      width="w-96"
      isOpen={isOpen}
      trigger={trigger}
      role={action.role === 'danger' ? 'danger' : 'primary'}
      icon={isRisky ? <AlertIcon size={ICON_SIZE.row} /> : <WorktreeIcon size={ICON_SIZE.row} />}
      title={title}
      confirmLabel={action.label}
      isBusy={isBusy}
      onConfirm={() => onConfirm({ disposition: action.disposition })}
      onCancel={onCancel}
      {...(isUnread
        ? { altAction: { label: 'Check again', onClick: onRecheck, disabled: isBusy } }
        : {})}
    >
      <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
        {plan.lines.map((line) => (
          <p key={line} className="break-words">
            {line}
          </p>
        ))}
      </div>
      {!hasDetails ? null : (
        <DetachDetails
          projectName={projectName}
          details={details}
          isBusy={isBusy}
          {...(isRisky ? { onKeepFiles: () => onConfirm({ disposition: 'keep-files' }) } : {})}
        />
      )}
      {stage === null ? null : (
        <p role="status" aria-live="polite" className="text-meta text-muted-foreground">
          {stage}
        </p>
      )}
    </ConfirmPopover>
  );
};
