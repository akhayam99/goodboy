import type { Agent } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { DockStopButton } from '../../../shared/components/DockStopButton';
import { AutoDock } from '../chat/AutoDock';
import { autoDockStopOf } from '../chat/autoDockStopOf';
import { useAutoTreeActions } from '../chat/useAutoTreeActions';
import { FIXTURE_SESSION } from './autoViewFixtures';

type Props = {
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
  readonly onOpenArtifact: (artifactId: string) => void;
};

export const AutoDockUnderTest = ({ view, rootAgent, onOpenArtifact }: Props) => {
  const actions = useAutoTreeActions({ sessionId: FIXTURE_SESSION });
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgent.id] ?? null);
  const stop = autoDockStopOf({
    view,
    rootTurn,
    rootAgent,
    isStopping: actions.isStopping,
    stop: () => void actions.stop({ view }),
  });
  return (
    <>
      <AutoDock
        sessionId={FIXTURE_SESSION}
        view={view}
        rootAgent={rootAgent}
        onOpenArtifact={onOpenArtifact}
        actions={actions}
      />
      {stop === null ? null : (
        <>
          <p role="status">{stop.sentence}</p>
          <DockStopButton stop={stop} />
        </>
      )}
    </>
  );
};
