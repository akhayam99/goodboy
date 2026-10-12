import { SelectableRow, cn, tintClasses } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useMountDiffStats } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { lensIconClass } from '../../../session/lens-labels';
import { openLens } from '../../../session/openLens';
import { DiffStat } from '../../../../shared/components/DiffStat';
import { isRunningWord, type PageSummaries } from '../../../session/pageCountWord';
import { singleBranchName } from '../../../session/singleBranchName';
import { sumMountDiffStats } from '../../../session/sumMountDiffStats';
import { splitBranchLabel } from '../../../../shared/utils/branchLabel';
import type { Page } from '../../../session/pageRegistry';
import { pageSummaryOf } from '../../../session/trail/menus/pageMenu';
import { BranchRows } from './BranchRows';
import type { CurrentSign } from './currentSign';

type Props = {
  readonly session: Session;
  readonly pages: ReadonlyArray<Page>;
  readonly summaries: PageSummaries;
  readonly sign: CurrentSign;
  readonly hasBranchRows?: boolean;
  readonly onOpened?: () => void;
};

const iconClassOf = ({ page }: { readonly page: Page }): string =>
  page.tint === null ? 'text-muted-foreground' : lensIconClass({ lens: page.tint });

export const SessionPages = ({
  session,
  pages,
  summaries,
  sign,
  hasBranchRows = true,
  onOpened,
}: Props) => {
  const sessionId = session.id as SessionId;
  const mountCount = useAppStore((state) => state.sessionProjectMounts?.[sessionId]?.length ?? 0);
  const branchName = useAppStore((state) =>
    singleBranchName({
      mounts: state.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY,
      sessionBranch: state.sessionBranches[sessionId] ?? null,
    }),
  );
  const diff = sumMountDiffStats({ stats: useMountDiffStats(sessionId) });

  const openPage = (page: Page) => {
    openLens({ sessionId, lens: page.lens });
    const state = useAppStore.getState();
    state.setFocusedArtifactId(sessionId, null);
    state.setFocusedWorkflowRun(sessionId, null);
    onOpened?.();
  };

  return (
    <ul
      aria-label="Pages"
      className="flex flex-col motion-safe:animate-nav-step-in"
      data-testid="session-pages"
    >
      {pages.map((page) => {
        const Icon = page.icon;
        const isCurrent = sign === page.id;
        const count = pageSummaryOf({ summaries, page });
        const isWarning = page.id === 'questions';
        const isRunning = page.id === 'runs' && count !== null && isRunningWord({ word: count });
        const isBranchName = page.id === 'branch' && count !== null && count === branchName;
        const { head, tail } = splitBranchLabel({ branch: isBranchName ? count : '' });
        const hasDiff = page.id === 'branch' && (diff.additions > 0 || diff.deletions > 0);
        return (
          <li key={page.id}>
            <SelectableRow
              selected={isCurrent}
              ariaCurrent={isCurrent ? 'page' : undefined}
              onClick={() => openPage(page)}
              className="h-7 items-center gap-2 px-2 text-label"
            >
              <Icon
                size={ICON_SIZE.row}
                aria-hidden
                className={cn('box-content shrink-0 p-px', iconClassOf({ page }))}
              />
              <span className="min-w-0 flex-1 truncate">{page.label}</span>
              {count === null ? null : (
                <span
                  className={cn(
                    'flex min-w-0 items-center',
                    isBranchName ? 'max-w-[60%] text-code' : 'shrink-0 text-meta tabular-nums',
                    isWarning && 'text-warning',
                    isRunning && tintClasses('info').text,
                    !isWarning && !isRunning && 'text-faint-foreground',
                  )}
                >
                  {isBranchName ? (
                    <>
                      <span className="truncate">{head}</span>
                      {tail === '' ? null : <span className="shrink-0">{tail}</span>}
                    </>
                  ) : (
                    count
                  )}
                </span>
              )}
              {hasDiff ? <DiffStat additions={diff.additions} deletions={diff.deletions} /> : null}
            </SelectableRow>
            {hasBranchRows && page.id === 'branch' && isCurrent && mountCount > 1 ? (
              <BranchRows sessionId={sessionId} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};
