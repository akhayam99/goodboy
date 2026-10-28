import { useMemo, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { Button, HeaderActions, HeaderBand, ICON_SIZE, Notice, Tooltip } from '@goodboy/ui';
import type { PullRequestHost, PullRequestState, SessionId } from '@goodboy/types';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { usePullRequestTitleEdit } from '../../hooks/usePullRequestTitleEdit';
import { PullRequestTitle } from '../PullRequestTab/PullRequestTitle';

import { actionButtonStateOf } from '../../../actions/actionButtonStateOf';
import { ActionConfirmPanel } from '../../../actions/components/ActionControls/ActionConfirmPanel';
import { ActionStatusLine } from '../../../actions/components/ActionControls/ActionStatusLine';
import type { BranchControls } from '../../hooks/useBranchControls';
import type { BranchPrimary } from '../../branchPrimary';
import { pushFailureOf } from '../../../actions/kinds/pushFailureOf';
import { PushFailureActions } from './PushFailureActions';
import { PushFailureBlock } from '../../../../shared/components/PushFailureBlock';
import { StartHint } from '../../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../../shared/components/startHintCopy';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';
import { requestNounLabel } from '../../requestNounLabel';
import { BranchOverflow } from './BranchOverflow';

type Props = {
  readonly sessionId: SessionId;
  readonly host?: PullRequestHost;
  readonly pr: PullRequestState | null;
  readonly fallbackTitle: string;
  readonly controls: BranchControls;
  readonly isPushBusy: boolean;
  readonly isPrimaryYielding: boolean;
  readonly tab: BranchTab;
  readonly isActive?: boolean;
  readonly canEditTitle: boolean;
  readonly pageAction?: ReactNode;
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
  tab,
  isActive = true,
  canEditTitle,
  pageAction = null,
  line = null,
  onMutated,
}: Props) => {
  const { primary, secondary } = controls;
  const titleEdit = usePullRequestTitleEdit({
    sessionId,
    pr,
    canEdit: canEditTitle,
    isKeyActive: isActive && tab === 'pr',
    onSaved: onMutated,
  });

  const failedError = controls.diffControls.failure?.error;
  const pushFailure = pushFailureOf({ error: failedError });
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

  const primaryId = primary?.actionId ?? null;
  const shownIds = useMemo(() => (primaryId === null ? [] : [primaryId]), [primaryId]);
  const primaryVariant = isPrimaryYielding ? 'secondary' : 'primary';
  return (
    <div className="relative flex min-w-0 flex-col gap-2">
      <HeaderBand
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
            {pageAction}
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
      <ActionStatusLine
        controls={controls.diffControls}
        showReasons={false}
        failureHint={
          pushFailure === null ? null : (
            <div className="w-full max-w-md">
              <StartHint
                sessionId={sessionId}
                scope={START_HINT_SCOPES.pushFix({ mountId: pushFailure.mountId })}
                label={START_HINT_COPY.implementerLabel}
                placeholder={START_HINT_COPY.pushFix}
              />
            </div>
          )
        }
        failureDetail={
          pushFailure === null ? null : <PushFailureBlock output={pushFailure.message} />
        }
        failureActions={
          pushFailure === null ? null : (
            <PushFailureActions
              sessionId={sessionId}
              mountId={pushFailure.mountId}
              isForce={pushFailure.isForce}
              confirmedOnlyOnline={
                pushFailure.confirmedOnlyOnline?.map((commit) => commit.sha) ?? null
              }
              confirmedRemoteSha={pushFailure.confirmedRemoteSha}
              message={pushFailure.message}
              onResolved={controls.diffControls.dismissFailure}
            />
          )
        }
      />
      <ActionConfirmPanel controls={controls.diffControls} />
      <ActionStatusLine controls={controls.pullRequestControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.pullRequestControls} />
    </div>
  );
};
