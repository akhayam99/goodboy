import type { Session } from '@goodboy/types';
import { SessionWorkspace } from '../../../../features/session/components/SessionWorkspace';
import { WorkflowsPane } from '../../../../features/session/components/SessionWorkspace/parts/WorkflowsPane';
import { usePresetRunFocus } from '../../../../features/session/hooks/usePresetRunFocus';

type Props = {
  readonly session: Session;
};

export const SceneRunsSurface = ({ session }: Props) => {
  const focus = usePresetRunFocus({ sessionId: session.id });
  if (focus === null) {
    return <WorkflowsPane session={session} />;
  }
  return <SessionWorkspace session={session} isActive />;
};
