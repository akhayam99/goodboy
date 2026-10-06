import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PANE_RHYTHM, SelectableRow, cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import {
  sessionPages,
  type SessionPage,
  type SessionPageId,
} from '../../../session/lens-destinations';
import { LENS_ICON, lensIconClass } from '../../../session/lens-labels';
import { openLens } from '../../../session/openLens';
import { usePageSummaries } from '../../../session/hooks/usePageSummaries';
import { pageSummaryOf } from '../../../session/trail/menus/pageMenu';

type Props = {
  readonly session: Session;
};

const PAGE_ICON: Record<SessionPageId, LucideIcon> = {
  overview: CONCEPT_ICONS.timeline,
  branch: LENS_ICON.branch,
  runs: LENS_ICON.workflows,
  agents: LENS_ICON.agents,
  artifacts: LENS_ICON.plans,
};

const PAGE_TINT: Record<SessionPageId, LensKind | null> = {
  overview: null,
  branch: 'branch',
  runs: 'workflows',
  agents: 'agents',
  artifacts: 'plans',
};

const iconClassOf = ({ page }: { readonly page: SessionPage }): string => {
  const lens = PAGE_TINT[page.id];
  return lens === null ? 'text-muted-foreground' : lensIconClass({ lens });
};

export const SessionPages = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const activeLens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const summaries = usePageSummaries({ session });
  const pages = useMemo(() => sessionPages({ isBranchless }), [isBranchless]);

  const openPage = (page: SessionPage) => {
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
        const Icon = PAGE_ICON[page.id];
        const isCurrent = page.currentLenses.includes(activeLens);
        const count = pageSummaryOf({ summaries, lens: page.lens });
        return (
          <li key={page.id}>
            <SelectableRow
              selected={isCurrent}
              ariaCurrent={isCurrent ? 'page' : undefined}
              onClick={() => openPage(page)}
              className={cn(
                'h-7 items-center gap-2 pr-2 text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                PANE_RHYTHM.navRail.nest,
              )}
            >
              <Icon
                size={ICON_SIZE.row}
                aria-hidden
                className={cn('shrink-0', iconClassOf({ page }))}
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
