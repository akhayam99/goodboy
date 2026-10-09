import { useMemo } from 'react';
import { SelectableRow, cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { lensIconClass } from '../../../session/lens-labels';
import { openLens } from '../../../session/openLens';
import { usePageSummaries } from '../../../session/hooks/usePageSummaries';
import { columnPagesOf, type Page } from '../../../session/pageRegistry';
import { pageSummaryOf } from '../../../session/trail/menus/pageMenu';

type Props = {
  readonly session: Session;
};

const iconClassOf = ({ page }: { readonly page: Page }): string =>
  page.tint === null ? 'text-muted-foreground' : lensIconClass({ lens: page.tint });

export const SessionPages = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const activeLens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const summaries = usePageSummaries({ session });
  const pages = useMemo(() => columnPagesOf({ isBranchless }), [isBranchless]);

  const openPage = (page: Page) => {
    openLens({ sessionId, lens: page.lens });
    const state = useAppStore.getState();
    state.setFocusedArtifactId(sessionId, null);
    state.setFocusedWorkflowRun(sessionId, null);
  };

  return (
    <ul
      aria-label="Pages"
      className="flex flex-col motion-safe:animate-nav-step-in"
      data-testid="session-pages"
    >
      {pages.map((page) => {
        const Icon = page.icon;
        const isCurrent = page.currentLenses.includes(activeLens);
        const count = pageSummaryOf({ summaries, page });
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
                <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
                  {count}
                </span>
              )}
            </SelectableRow>
          </li>
        );
      })}
    </ul>
  );
};
