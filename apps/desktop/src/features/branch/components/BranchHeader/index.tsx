import { ArrowRight, Check } from 'lucide-react';
import { Button, HeaderBand, Tooltip, cn } from '@goodboy/ui';
import type { PrCheckRun, PrDetail, PullRequestState, SessionId } from '@goodboy/types';
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
}: Props) => {
  const { primary } = controls;
  const summary = summaryOf({ pr, detail });
  const head = pr?.headBranch ?? branch;
  const base = pr?.baseBranch ?? baseBranch;
  const abort =
    controls.diffControls.actions.find((action) => action.id === 'diff.abortRebase') ?? null;
  const blockedReason =
    primary === null || primary.isBusy || isPushBusy ? null : primary.blockedReason;
  const primaryButton =
    primary === null ? null : (
      <Button
        size="sm"
        variant="primary"
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
        title={
          <span className="flex min-w-0 items-baseline gap-2">
            {pr !== null && <span className="shrink-0 text-faint-foreground">#{pr.number}</span>}
            <span className="min-w-0 truncate">{pr?.title ?? fallbackTitle}</span>
          </span>
        }
        meta={
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
            <span className="text-foreground">{stateWord(pr)}</span>
            {head !== null && (
              <>
                <span aria-hidden>·</span>
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
            {head === null && projectName !== null && (
              <>
                <span aria-hidden>·</span>
                <span className="text-code">{projectName}</span>
              </>
            )}
            {summary !== null && (
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
            {blockedReason !== null && (
              <>
                <span aria-hidden>·</span>
                <span data-testid="branch-blocked-reason" className="min-w-0">
                  {blockedReason}
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
      <ActionStatusLine controls={controls.diffControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.diffControls} />
      <ActionStatusLine controls={controls.pullRequestControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.pullRequestControls} />
    </div>
  );
};
