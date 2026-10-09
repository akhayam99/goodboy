import { SelectableRow, cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { lensIconClass } from '../../../session/lens-labels';
import { openLens } from '../../../session/openLens';
import type { PageSummaries } from '../../../session/pageCountWord';
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
                    'shrink-0 text-meta tabular-nums',
                    isWarning ? 'text-warning' : 'text-faint-foreground',
                  )}
                >
                  {count}
                </span>
              )}
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
