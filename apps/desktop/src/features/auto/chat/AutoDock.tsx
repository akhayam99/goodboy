import type { Agent, SessionId } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { AutoDockLive } from './AutoDockLive';
import { AutoDockPlan } from './AutoDockPlan';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
  readonly onOpenArtifact: (artifactId: string) => void;
};

export const AutoDock = ({ sessionId, view, rootAgent, onOpenArtifact }: Props) => {
  const plan = view.artifacts.filter((row) => row.artifact.kind === 'plan').at(-1) ?? null;
  return (
    <div
      data-auto-dock=""
      className="flex min-w-0 flex-col gap-1 rounded-lg bg-subtle px-3 py-2 empty:hidden"
    >
      {plan === null ? null : (
        <AutoDockPlan
          sessionId={sessionId}
          artifactId={plan.artifact.artifactId}
          title={plan.title}
          onOpen={onOpenArtifact}
        />
      )}
      <AutoDockLive sessionId={sessionId} view={view} rootAgent={rootAgent} />
    </div>
  );
};
