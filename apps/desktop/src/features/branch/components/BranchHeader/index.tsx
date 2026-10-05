import { ArrowRight, Check } from 'lucide-react';
import { Button, HeaderBand, Tooltip, cn } from '@goodboy/ui';
import type { PrCheckRun, PullRequestState } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ActionConfirmPanel } from '../../../actions/components/ActionControls/ActionConfirmPanel';
import { ActionStatusLine } from '../../../actions/components/ActionControls/ActionStatusLine';
import type { BranchControls } from '../../hooks/useBranchControls';
import { checksSummaryOf } from '../../checksSummary';
import { BranchOverflow } from './BranchOverflow';

type Props = {
  readonly pr: PullRequestState | null;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly projectName: string | null;
  readonly branch: string | null;
  readonly baseBranch: string | null;
  readonly fallbackTitle: string;
  readonly controls: BranchControls;
  readonly isPushBusy: boolean;
};

const stateWord = (pr: PullRequestState | null): string => {
  if (pr === null) {
    return 'No pull request';
  }
  if (pr.isDraft && pr.state === 'open') {
    return 'Draft';
  }
  return pr.state.charAt(0).toUpperCase() + pr.state.slice(1);
};

export const BranchHeader = ({
  pr,
  checks,
  projectName,
  branch,
  baseBranch,
  fallbackTitle,
  controls,
  isPushBusy,
}: Props) => {
  const { primary } = controls;
  const summary = pr === null ? null : checksSummaryOf({ rollup: pr.checks, checks });
  const head = pr?.headBranch ?? branch;
  const base = pr?.baseBranch ?? baseBranch;
  const abort =
    controls.diffControls.actions.find((action) => action.id === 'diff.abortRebase') ?? null;
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
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
            <span className="text-foreground">{stateWord(pr)}</span>
            {projectName !== null && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">{projectName}</span>
              </>
            )}
            {head !== null && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex min-w-0 items-center gap-1 font-mono">
                  {head}
                  {base !== null && (
                    <>
                      <ArrowRight size={ICON_SIZE.row} aria-hidden />
                      {base}
                    </>
                  )}
                </span>
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
          </p>
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
