import { useCallback, useMemo } from 'react';
import { Kanban, PanelLeft, Plus } from 'lucide-react';
import { Divider, ScrollFade, Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { isPrReviewSession } from '../../../../../store/slices/session-view';
import { useIsBranchlessSession } from '../../../hooks/useIsBranchlessSession';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { LENS_SHORTCUTS, buildLensGroups } from './LensNav/groups';
import { WorkspaceRailBadge } from './WorkspaceRailBadge';

type Props = {
  readonly session: Session;
  readonly onExpand: () => void;
};

const railButton = (isActive: boolean): string =>
  cn(
    'flex size-8 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
    isActive
      ? cn(tintClasses('primary').bg, tintClasses('primary').text)
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
  );

export const CollapsedRail = ({ session, onExpand }: Props) => {
  const sessionId = session.id as SessionId;
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const activeLens = useAppStore((s) => s.activeLens[sessionId] ?? null);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const isBranchless = useIsBranchlessSession({ session });
  const isPrReview = useMemo(() => isPrReviewSession({ agents: phaseRuns }), [phaseRuns]);

  const rows = useMemo(
    () =>
      buildLensGroups({
        isBranchless,
        isPrReview,
        reviewDraftCount: 0,
        activeWorkflows: 0,
        attentionLens: null,
        unreadLens: null,
        agentCount: 0,
        areAgentsLoading: false,
        hasRunningAgent: false,
        openResolvers: 0,
        hasPendingBatch: false,
        openCount: 0,
        areQuestionsLoading: false,
        filesCount: 0,
        activePlans: 0,
        arePlansLoading: false,
        runningScripts: 0,
        liveTerminals: 0,
        integrationRows: EMPTY_ARRAY,
      })
        .flatMap((group) => group.rows)
        .filter((row) => row.icon != null),
    [isBranchless, isPrReview],
  );

  const onBoard = useCallback(() => {
    void setCurrentSession(null);
  }, [setCurrentSession]);

  return (
    <div className="flex h-full w-11 min-w-0 flex-col items-center gap-1 py-2">
      <Tooltip content={`Show session sidebar (${shortcutGlyphs('column.toggle')})`} side="right">
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Show session sidebar (${shortcutGlyphs('column.toggle')})`}
          className={railButton(false)}
        >
          <PanelLeft size={15} aria-hidden />
        </button>
      </Tooltip>
      <WorkspaceRailBadge />
      <Tooltip content={`Back to board (${shortcutGlyphs('session.board')})`} side="right">
        <button
          type="button"
          onClick={onBoard}
          aria-label={`Back to board (${shortcutGlyphs('session.board')})`}
          className={railButton(false)}
        >
          <Kanban size={15} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content={`New session (${shortcutGlyphs('session.new')})`} side="right">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
          aria-label={`New session (${shortcutGlyphs('session.new')})`}
          className={railButton(false)}
        >
          <Plus size={15} aria-hidden />
        </button>
      </Tooltip>
      <Divider className="my-1 w-5" />
      <ScrollFade className="min-h-0 flex-1">
        <nav aria-label="Session lenses" className="flex flex-col items-center gap-1">
          {rows.map((row) => {
            const isActive = activeLens === row.kind;
            const label = `${row.label} (${shortcutGlyphs(LENS_SHORTCUTS[row.kind])})`;
            return (
              <Tooltip key={row.kind} content={label} side="right">
                <button
                  type="button"
                  onClick={() => setActiveLens(sessionId, row.kind)}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  className={railButton(isActive)}
                >
                  {row.icon != null ? <row.icon size={15} aria-hidden /> : null}
                </button>
              </Tooltip>
            );
          })}
        </nav>
      </ScrollFade>
    </div>
  );
};
