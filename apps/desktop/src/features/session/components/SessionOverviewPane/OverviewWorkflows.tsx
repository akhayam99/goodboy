import { Eyebrow, Chip } from '@goodboy/ui';
import type { Session, SessionProjectMount } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const OverviewWorkflows = ({ session, onSelectLens }: Props) => {
  const attached = useAttachedWorkflowRuns({ session });
  const mounts = useAppStore(
    (s) =>
      s.sessionProjectMounts[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<SessionProjectMount>),
  );
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);

  const active = attached.filter(({ run }) => run.discardedAt == null);
  if (active.length === 0) {
    return null;
  }

  return (
    <section aria-label="Workflows" className="flex flex-col gap-2">
      <Eyebrow label="Workflows" />
      <ul className="flex flex-col gap-1.5">
        {active.map(({ run, workflow }) => (
          <li key={run.id}>
            <button
              type="button"
              onClick={() => {
                setFocusedWorkflowRun(session.id, run.id);
                onSelectLens('workflows');
              }}
              className="flex w-full items-center gap-3 rounded-lg border-l-2 border-border-soft bg-transparent px-3 py-2 text-left hover:bg-muted/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {run.goal ?? workflow.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  step {Math.min(run.currentStep + 1, workflow.steps.length)} of{' '}
                  {workflow.steps.length}
                </span>
              </span>
              {mounts.length > 1 ? (
                <span className="flex shrink-0 items-center gap-1">
                  {mounts.map((mount) => (
                    <Chip
                      key={mount.projectId}
                      tone="neutral"
                      size="3xs"
                      bordered={false}
                      label={mount.mountName}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
