import { useMemo, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { Button, HeaderActions, ICON_SIZE, Notice, PaneTitleRow, Tooltip } from '@goodboy/ui';
import type { PullRequestHost, PullRequestState, SessionId } from '@goodboy/types';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import { usePullRequestTitleEdit } from '../../hooks/usePullRequestTitleEdit';
import { PullRequestTitle } from '../PullRequestTab/PullRequestTitle';

import { actionButtonStateOf } from '../../../actions/actionButtonStateOf';
import type { BranchControls } from '../../hooks/useBranchControls';
import { branchShownIdsOf, type BranchPrimary } from '../../branchPrimary';
import { requestNounLabel } from '../../requestNounLabel';
import { BranchOverflow } from './BranchOverflow';
import { BranchStateChip } from './BranchStateChip';

type Props = {
  readonly sessionId: SessionId;
  readonly host?: PullRequestHost;
  readonly pr: PullRequestState | null;
  readonly fallbackTitle: string;
  readonly controls: BranchControls;
  readonly isPushBusy: boolean;
  readonly isPrimaryYielding: boolean;
  readonly isStepHidden?: boolean;
  readonly tab: BranchTab;
  readonly isActive?: boolean;
  readonly canEditTitle: boolean;
  readonly line?: ReactNode;
  readonly onMutated: () => void;
};

type ButtonParams = {
  readonly action: BranchPrimary;
  readonly slot: 'primary' | 'secondary';
  readonly variant: 'primary' | 'secondary';
};

export const BranchHeader = ({
  sessionId,
  host = 'github',
  pr,
  fallbackTitle,
  controls,
  isPushBusy,
  isPrimaryYielding,
  isStepHidden = false,
  tab,
  isActive = true,
  canEditTitle,
  line = null,
  onMutated,
}: Props) => {
  const primary = isStepHidden ? null : controls.primary;
  const secondary = isStepHidden ? null : controls.secondary;
  const titleEdit = usePullRequestTitleEdit({
    sessionId,
    pr,
    canEdit: canEditTitle,
    isKeyActive: isActive && tab === 'pr',
    onSaved: onMutated,
  });

  const buttonOf = ({ action, slot, variant }: ButtonParams) => {
    const state = actionButtonStateOf({
      controls: controls.controlsOf(action),
      actionId: action.actionId,
      label: action.label,
      pendingLabel: action.pendingLabel,
      isBusy: action.isBusy || isPushBusy,
    });
    const tip = action.blockedReason ?? action.note;
    const button = (
      <Button
        size="sm"
        variant={variant}
        data-variant={variant}
        data-branch-primary={slot === 'primary' ? action.actionId : undefined}
        data-branch-secondary={slot === 'secondary' ? action.actionId : undefined}
        disabled={action.blockedReason !== null}
        aria-expanded={action.isExpanded ?? undefined}
        isBusy={state.isBusy}
        busyLabel={state.label}
        onClick={() => controls.press(action)}
      >
        <action.icon size={ICON_SIZE.control} aria-hidden />
        {action.label}
        {action.isExpanded === true && <ChevronUp size={ICON_SIZE.control} aria-hidden />}
      </Button>
    );
    return tip === null ? (
      button
    ) : (
      <Tooltip content={tip} anchorClassName="shrink-0">
        <span className="inline-flex">{button}</span>
      </Tooltip>
    );
  };

  const { step } = controls;
  const shownIds = useMemo(
    () => branchShownIdsOf({ primary, secondary, step }),
    [primary, secondary, step],
  );
  const isYielding =
    isPrimaryYielding ||
    controls.diffControls.confirming !== null ||
    controls.pullRequestControls.confirming !== null ||
    controls.sessionControls.confirming !== null;
  const primaryVariant = isYielding ? 'secondary' : 'primary';
  return (
    <div className="relative flex min-w-0 flex-col gap-2">
      <PaneTitleRow
        badge={
          pr === null ? null : (
            <BranchStateChip
              state={pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft })}
              host={host}
            />
          )
        }
        title={
          <PullRequestTitle
            title={pr?.title ?? fallbackTitle}
            edit={titleEdit}
            noun={requestNounLabel({ host })}
          />
        }
        meta={
          titleEdit.isEditing ? (
            <span className="text-meta text-muted-foreground">Enter saves, Esc cancels</span>
          ) : (
            line
          )
        }
        actions={
          <div className="flex min-w-0 items-center gap-2">
            <HeaderActions
              secondary={
                secondary === null
                  ? null
                  : buttonOf({ action: secondary, slot: 'secondary', variant: 'secondary' })
              }
              primary={
                primary === null
                  ? null
                  : buttonOf({ action: primary, slot: 'primary', variant: primaryVariant })
              }
              overflow={
                <BranchOverflow
                  diffControls={controls.diffControls}
                  pullRequestControls={controls.pullRequestControls}
                  shownIds={shownIds}
                  isRebaseStopOpen={controls.hasOpenRebaseStop}
                  onPush={controls.pushFromMenu}
                />
              }
            />
          </div>
        }
      />
      {titleEdit.error !== null && (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="Couldn't save the title"
          body={titleEdit.error}
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={titleEdit.save}
              isBusy={titleEdit.isBusy}
            >
              Retry
            </Button>
          }
        />
      )}
    </div>
  );
};
