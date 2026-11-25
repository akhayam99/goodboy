import type { Agent } from '@goodboy/types';
import { AutoDock } from '../../../../../features/auto/chat/AutoDock';
import { useAutoTreeActions } from '../../../../../features/auto/chat/useAutoTreeActions';
import { FIXTURE_SESSION } from '../../../../../features/auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';

type Props = {
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
};

export const SceneDock = ({ view, rootAgent }: Props) => {
  const actions = useAutoTreeActions({ sessionId: FIXTURE_SESSION });
  return (
    <AutoDock
      sessionId={FIXTURE_SESSION}
      view={view}
      rootAgent={rootAgent}
      onOpenArtifact={() => undefined}
      actions={actions}
    />
  );
};
