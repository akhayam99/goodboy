import { ArrowRight, Check } from 'lucide-react';
import { Button, HeaderBand, Notice, Tooltip, cn } from '@goodboy/ui';
import type { PrCheckRun, PrDetail, PullRequestState, SessionId } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { usePullRequestTitleEdit } from '../../hooks/usePullRequestTitleEdit';
import { PullRequestTitle } from '../PullRequestTab/PullRequestTitle';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ActionConfirmPanel } from '../../../actions/components/ActionControls/ActionConfirmPanel';
import { ActionStatusLine } from '../../../actions/components/ActionControls/ActionStatusLine';
import { checksWordOf } from '../../../integrations/github/checksRollup';
import type { BranchControls } from '../../hooks/useBranchControls';
import { checksSummaryOf, type ChecksSummary } from '../../checksSummary';
import { pullRequestWord } from '../../pullRequestWord';
import { BranchOverflow } from './BranchOverflow';
import { BranchSwitcher } from './BranchSwitcher';

type Props = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
  readonly projectName: string | null;
  readonly branch: string | null;
  readonly baseBranch: string | null;
  readonly fallbackTitle: string;
  readonly controls: BranchControls;
  readonly isPushBusy: boolean;
  readonly tab: BranchTab;
  readonly isActive?: boolean;
  readonly canEditTitle: boolean;
  readonly createdAt: string | null;
  readonly onMutated: () => void;
};

const NO_CHECKS: ReadonlyArray<PrCheckRun> = [];
const CHECKS_UNKNOWN: ChecksSummary = { tone: 'muted', label: 'Checks unknown' };

type SummaryParams = {
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
};

const summaryOf = ({ pr, detail }: SummaryParams): ChecksSummary | null => {
  if (pr === null) {
    return null;
  }
  if (checksWordOf({ pr, detail }) === 'unknown') {
    return CHECKS_UNKNOWN;
  }
  return checksSummaryOf({ rollup: pr.checks, checks: detail?.checks ?? NO_CHECKS });
};

const INTENT_WORD: Readonly<Record<PullRequestState['state'], string>> = {
  draft: 'wants to merge',
  open: 'wants to merge',
  approved: 'wants to merge',
  queued: 'wants to merge',
  merged: 'merged',
  closed: 'wanted to merge',
};

const stateWord = (pr: PullRequestState | null): string => {
  if (pr === null) {
    return 'No pull request';
  }
  return pullRequestWord({ state: pr.state, isDraft: pr.isDraft });
};

export const BranchHeader = ({
  sessionId,
  mountPath,
  pr,
  detail,
  projectName,
  branch,
  baseBranch,
  fallbackTitle,
  controls,
  isPushBusy,
  tab,
  isActive = true,
  canEditTitle,
  createdAt,
  onMutated,
}: Props) => {
  const { primary } = controls;
  const titleEdit = usePullRequestTitleEdit({
    sessionId,
    pr,
    canEdit: canEditTitle,
    isKeyActive: isActive && tab === 'pr',
    onSaved: onMutated,
  });
  const now = useNow(60_000);
  const age = createdAt === null ? '' : formatAge({ from: createdAt, now });
  const summary = summaryOf({ pr, detail });
  const head = pr?.headBranch ?? branch;
  const base = pr?.baseBranch ?? baseBranch;
  const abort =
    controls.diffControls.actions.find((action) => action.id === 'diff.abortRebase') ?? null;
  const isQuiet = primary === null || primary.isBusy || isPushBusy;
  const blockedReason = isQuiet ? null : primary.blockedReason;
  const note = isQuiet ? null : primary.note;
  const primaryButton =
    primary === null ? null : (
      <Button
        size="sm"
        variant={primary.isSecondary ? 'secondary' : 'primary'}
        data-branch-primary={primary.actionId}
        disabled={primary.blockedReason !== null}
        isBusy={primary.isBusy || isPushBusy}
        onClick={controls.press}
      >
        <primary.icon size={ICON_SIZE.control} aria-hidden />
        {primary.label}
      </Button>
    );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <HeaderBand
        title={<PullRequestTitle title={pr?.title ?? fallbackTitle} edit={titleEdit} />}
        meta={
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
            {titleEdit.isEditing ? (
              <span>Enter saves, Esc cancels</span>
            ) : (
              <span className="text-foreground">{stateWord(pr)}</span>
            )}
            {!titleEdit.isEditing && head !== null && (
              <>
                <span aria-hidden>·</span>
                {pr?.author != null && (
                  <span>
                    {pr.author} {INTENT_WORD[pr.state]}
                  </span>
                )}
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
                {age !== '' && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{age}</span>
                  </>
                )}
              </>
            )}
            {!titleEdit.isEditing && head === null && projectName !== null && (
              <>
                <span aria-hidden>·</span>
                <span className="text-code">{projectName}</span>
              </>
            )}
            {!titleEdit.isEditing && summary !== null && (
              <>
                <span aria-hidden>·</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    summary.tone === 'success' && 'text-success',
                    summary.tone === 'danger' && 'text-danger',
                  )}
                >
                  {summary.tone === 'success' && <Check size={ICON_SIZE.row} aria-hidden />}
                  {summary.label}
                </span>
              </>
            )}
            {!titleEdit.isEditing && blockedReason !== null && (
              <>
                <span aria-hidden>·</span>
                <span data-testid="branch-blocked-reason" className="min-w-0">
                  {blockedReason}
                </span>
              </>
            )}
            {!titleEdit.isEditing && blockedReason === null && note !== null && (
              <>
                <span aria-hidden>·</span>
                <span data-testid="branch-merge-note" className="min-w-0">
                  {note}
                </span>
              </>
            )}
          </div>
        }
        actions={
          <>
            {abort !== null && (
              <Button
                size="sm"
                variant="secondary"
                disabled={abort.blockedReason !== null}
                onClick={() => controls.diffControls.trigger({ actionId: abort.id })}
              >
                {abort.shortLabel}
              </Button>
            )}
            {primary !== null && primary.blockedReason !== null ? (
              <Tooltip content={primary.blockedReason} anchorClassName="shrink-0">
                <span className="inline-flex">{primaryButton}</span>
              </Tooltip>
            ) : (
              primaryButton
            )}
            <BranchOverflow
              diffControls={controls.diffControls}
              pullRequestControls={controls.pullRequestControls}
            />
          </>
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
      <ActionStatusLine controls={controls.diffControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.diffControls} />
      <ActionStatusLine controls={controls.pullRequestControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.pullRequestControls} />
    </div>
  );
};
