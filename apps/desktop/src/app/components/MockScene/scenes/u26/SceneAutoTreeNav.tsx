import type { AgentId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SpawnedAutoFocus } from '../../../SpawnedPanel/SpawnedAutoFocus';
import { SpawnedFocusFoot } from '../../../SpawnedPanel/SpawnedFocusFoot';
import { WorkTimeProvider } from '../../../../../features/workTreeModel/components/WorkTimeProvider';

type Props = {
  readonly session: Session;
  readonly rootAgentId: AgentId;
};

export const SceneAutoTreeNav = ({ session, rootAgentId }: Props) => {
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[session.id] ?? null);
  return (
    <nav
      aria-label="Sidebar"
      className="flex h-full w-60 shrink-0 flex-col gap-2 border-r border-border-soft px-2 pt-1"
    >
      <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <SpawnedAutoFocus
            sessionId={session.id}
            rootAgentId={rootAgentId}
            selectedAgentId={selectedAgentId}
          />
        </div>
      </WorkTimeProvider>
      <SpawnedFocusFoot session={session} focus={{ kind: 'auto', rootAgentId }} />
    </nav>
  );
};
