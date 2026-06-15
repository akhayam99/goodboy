import { ArrowUpRight, ClipboardList, FileEdit } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { PlanStatus, SessionId } from '@goodboy/types';
import type { FilesTouchedShape } from '../lib';
import { GithubStrip } from './GithubStrip';
import { GitlabMrStrip } from './GitlabMrStrip';
import { PendingResolutionsStrip } from './PendingResolutionsStrip';

const PLAN_STATUS_STYLE: Record<PlanStatus, string> = {
  active: 'bg-warning/10 text-warning',
  consumed: 'bg-info/10 text-info',
  superseded: 'bg-muted text-muted-foreground',
  discarded: 'bg-muted/60 text-muted-foreground/70 line-through',
};

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  active: 'Active',
  consumed: 'Consumed',
  superseded: 'Superseded',
  discarded: 'Discarded',
};

interface ChangesStripProps {
  sessionId: SessionId;
  workingDir: string | null;
  filesTouched: FilesTouchedShape;
  plans: ReadonlyArray<{ id: string; status: PlanStatus; title: string }>;
  plansLoading: boolean;
  hasActivePlan: boolean;
}

export function ChangesStrip({
  sessionId,
  workingDir,
  filesTouched,
  plans,
  plansLoading,
  hasActivePlan,
}: ChangesStripProps) {
  const count = filesTouched.count;

  const openPlanStudio = () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-plan-studio', { detail: { sessionId } }));

  const openDiffViewer = () =>
    window.dispatchEvent(
      new CustomEvent('goodboy:open-diff-viewer', { detail: { sessionId, workingDir } }),
    );

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border-soft/50 pt-2.5">
      {plans.length === 0 && plansLoading ? (
        <PlansSkeleton />
      ) : (
        <button
          type="button"
          onClick={openPlanStudio}
          title="Open Plan Studio"
          aria-label="Open Plan Studio"
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ring-1 transition-colors hover:bg-foreground/5',
            plans.length > 0
              ? 'ring-border-soft'
              : 'text-muted-foreground/70 ring-border-soft/40 hover:text-foreground',
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <ClipboardList size={12} aria-hidden />
            {plans.length > 0 ? (
              <span className="font-medium">
                {plans.length} plan{plans.length === 1 ? '' : 's'}
              </span>
            ) : (
              <span>No plans yet. Spawn a Plan agent and ask it to map the work.</span>
            )}
            {hasActivePlan ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide',
                  PLAN_STATUS_STYLE['active'],
                )}
              >
                {PLAN_STATUS_LABEL['active']}
              </span>
            ) : null}
          </span>
          <ArrowUpRight size={12} aria-hidden className="shrink-0 opacity-70" />
        </button>
      )}
      <GithubStrip sessionId={sessionId} />
      <GitlabMrStrip sessionId={sessionId} />
      <PendingResolutionsStrip sessionId={sessionId} />
      {count > 0 ? (
        <button
          type="button"
          onClick={openDiffViewer}
          disabled={!workingDir}
          title={workingDir ? 'open the diff viewer' : 'no worktree for this session'}
          className="flex w-full items-center justify-between gap-2 rounded-lg bg-info/5 px-3 py-2 text-xs text-info ring-1 ring-info/20 transition-colors hover:bg-info/10 disabled:cursor-default disabled:opacity-60"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <FileEdit size={12} aria-hidden />
            <span className="truncate font-medium">
              {count} file{count === 1 ? '' : 's'} touched
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2">
            {filesTouched.additions > 0 || filesTouched.deletions > 0 ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums">
                {filesTouched.additions > 0 ? (
                  <span className="text-success">+{filesTouched.additions}</span>
                ) : null}
                {filesTouched.deletions > 0 ? (
                  <span className="text-danger">−{filesTouched.deletions}</span>
                ) : null}
              </span>
            ) : null}
            <ArrowUpRight size={12} aria-hidden className="opacity-70" />
          </span>
        </button>
      ) : (
        <div className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground/60 ring-1 ring-border-soft/40">
          <FileEdit size={12} aria-hidden />
          <span className="font-medium">working tree clean</span>
        </div>
      )}
    </div>
  );
}

function PlansSkeleton() {
  return (
    <div role="status" aria-label="loading plans" className="flex flex-col gap-2 pb-2">
      <div className="h-2.5 w-16 rounded bg-muted/50" />
      <div className="h-3 w-full rounded bg-muted/50" />
      <div className="h-3 w-2/3 rounded bg-muted/50" />
    </div>
  );
}
