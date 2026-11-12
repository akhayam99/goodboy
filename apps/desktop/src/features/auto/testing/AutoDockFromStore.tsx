import type { Agent, SessionId } from '@goodboy/types';
import { AutoDock } from '../chat/AutoDock';
import { useAutoTreeActions } from '../chat/useAutoTreeActions';
import { useAutoTreeViews } from '../useAutoTreeViews';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgent: Agent;
  readonly onOpenArtifact: (artifactId: string) => void;
};

export const AutoDockFromStore = ({ sessionId, rootAgent, onOpenArtifact }: Props) => {
  const actions = useAutoTreeActions({ sessionId });
  const views = useAutoTreeViews({ sessionId });
  const view = views.find((candidate) => candidate.tree.rootAgentId === rootAgent.id);
  if (view === undefined) {
    return null;
  }
  return (
    <AutoDock
      sessionId={sessionId}
      view={view}
      rootAgent={rootAgent}
      onOpenArtifact={onOpenArtifact}
      actions={actions}
    />
  );
};
