import { ArrowRight, ChevronUp } from 'lucide-react';
import {
  Button,
  HeaderActions,
  HeaderBand,
  Notice,
  Tooltip,
  useInheritedPaneActions,
} from '@goodboy/ui';
import { PULL_REQUEST_NOUNS } from '@goodboy/core';
import type { PullRequestHost, PullRequestState, SessionId } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { usePullRequestTitleEdit } from '../../hooks/usePullRequestTitleEdit';
import { PullRequestTitle } from '../PullRequestTab/PullRequestTitle';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { actionButtonStateOf } from '../../../actions/actionButtonStateOf';
import { ActionConfirmPanel } from '../../../actions/components/ActionControls/ActionConfirmPanel';
import { ActionStatusLine } from '../../../actions/components/ActionControls/ActionStatusLine';
import type { BranchControls } from '../../hooks/useBranchControls';
import type { BranchPrimary } from '../../branchPrimary';
import { queueLineOf } from '../../queueLineOf';
import { pullRequestKindOf } from '../../../../shared/pullRequestKind';
import type { PullRequestPresentationState } from '../../../../shared/pullRequestPresentation';
import { pushFailureOf } from '../../../actions/kinds/pushFailureOf';
import { PushFailureActions } from './PushFailureActions';
import { StartHint } from '../../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../../shared/components/startHintCopy';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';
import { BranchStateChip } from './BranchStateChip';
import { BranchOverflow } from './BranchOverflow';
import { BranchSwitcher } from './BranchSwitcher';

type Props = {
  readonly sessionId: SessionId;
  readonly host?: PullRequestHost;
  readonly mountPath: string | null;
  readonly pr: PullRequestState | null;
  readonly projectName: string | null;
  readonly branch: string | null;
  readonly baseBranch: string | null;
  readonly fallbackTitle: string;
  readonly controls: BranchControls;
  readonly isPushBusy: boolean;
  readonly isPrimaryYielding: boolean;
  readonly tab: BranchTab;
  readonly isActive?: boolean;
  readonly canEditTitle: boolean;
  readonly createdAt: string | null;
  readonly commitCount: number | null;
  readonly onMutated: () => void;
};

type ButtonParams = {
  readonly action: BranchPrimary;
  readonly slot: 'primary' | 'secondary';
  readonly variant: 'primary' | 'secondary';
};

const capitalized = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const stateOf = (pr: PullRequestState | null): PullRequestPresentationState =>
  pr === null ? 'none' : pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft });

export const BranchHeader = ({
  sessionId,
  host = 'github',
  mountPath,
  pr,
  projectName,
  branch,
  baseBranch,
  fallbackTitle,
  controls,
  isPushBusy,
  isPrimaryYielding,
  tab,
  isActive = true,
  canEditTitle,
  createdAt,
  commitCount,
  onMutated,
}: Props) => {
  const inheritedActions = useInheritedPaneActions();
  const { primary, secondary } = controls;
  const titleEdit = usePullRequestTitleEdit({
    sessionId,
    pr,
    canEdit: canEditTitle,
    isKeyActive: isActive && tab === 'pr',
    onSaved: onMutated,
  });
  const now = useNow(60_000);
  const age = createdAt === null ? '' : formatAge({ from: createdAt, now });
  const head = pr?.headBranch ?? branch;
  const base = pr?.baseBranch ?? baseBranch;
  const abort =
    controls.diffControls.actions.find((action) => action.id === 'diff.abortRebase') ?? null;
  const isQuiet = primary === null || primary.isBusy || isPushBusy;
  const blockedReason = isQuiet ? null : primary.blockedReason;
  const note = isQuiet ? null : primary.note;
  const queueLine = pr === null ? null : queueLineOf({ pr });
  const numberLabel =
    pr === null
      ? null
      : host === 'github'
        ? `#${pr.number}`
        : `${PULL_REQUEST_NOUNS[host].short} ${PULL_REQUEST_NOUNS[host].numberPrefix}${pr.number}`;

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
    return action.blockedReason === null ? (
      button
    ) : (
      <Tooltip content={action.blockedReason} anchorClassName="shrink-0">
        <span className="inline-flex">{button}</span>
      </Tooltip>
    );
  };

  const primaryVariant =
    primary === null || primary.isSecondary || isPrimaryYielding ? 'secondary' : 'primary';
  const separator = <span aria-hidden>·</span>;
  return (
    <div className="relative flex min-w-0 flex-col gap-2">
      <HeaderBand
        title={
          <PullRequestTitle
            title={pr?.title ?? fallbackTitle}
            edit={titleEdit}
            noun={capitalized(PULL_REQUEST_NOUNS[host].long)}
          />
        }
        afterTitle={
          titleEdit.isEditing ? null : <BranchStateChip state={stateOf(pr)} host={host} />
        }
        meta={
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
            {titleEdit.isEditing ? <span>Enter saves, Esc cancels</span> : null}
            {!titleEdit.isEditing && head !== null && (
              <>
                <BranchSwitcher
                  sessionId={sessionId}
                  currentPath={mountPath}
                  repoName={projectName}
                  branch={head}
                />
                {base !== null && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <ArrowRight size={ICON_SIZE.row} aria-hidden />
                    <span className="text-code">{base}</span>
                  </span>
                )}
              </>
            )}
            {!titleEdit.isEditing && head === null && projectName !== null && (
              <span className="text-code">{projectName}</span>
            )}
            {!titleEdit.isEditing && numberLabel !== null && (
              <>
                {separator}
                <span>
                  {numberLabel}
                  {pr?.author != null && ` by ${pr.author}`}
                </span>
              </>
            )}
            {!titleEdit.isEditing && commitCount !== null && (
              <>
                {separator}
                <span>
                  {commitCount} {commitCount === 1 ? 'commit' : 'commits'}
                </span>
              </>
            )}
            {!titleEdit.isEditing && age !== '' && (
              <>
                {separator}
                <span>{age}</span>
              </>
            )}
            {!titleEdit.isEditing && blockedReason !== null && (
              <>
                {separator}
                <span data-testid="branch-blocked-reason" className="min-w-0">
                  {blockedReason}
                </span>
              </>
            )}
            {!titleEdit.isEditing && blockedReason === null && note !== null && (
              <>
                {separator}
                <span data-testid="branch-merge-note" className="min-w-0">
                  {note}
                </span>
              </>
            )}
            {!titleEdit.isEditing && queueLine !== null && (
              <>
                {separator}
                <span data-testid="branch-queue-line" className="min-w-0 text-foreground">
                  {queueLine}
                </span>
              </>
            )}
          </div>
        }
        actions={
          <div className="flex min-w-0 items-center gap-2">
            <HeaderActions
              secondary={
                secondary === null
                  ? null
                  : buttonOf({ action: secondary, slot: 'secondary', variant: 'secondary' })
              }
              button={
                abort === null ? null : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={abort.blockedReason !== null}
                    onClick={() => controls.diffControls.trigger({ actionId: abort.id })}
                  >
                    {abort.shortLabel}
                  </Button>
                )
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
                />
              }
            />
            {inheritedActions}
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
