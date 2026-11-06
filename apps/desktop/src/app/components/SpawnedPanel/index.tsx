import { DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { WorkTimeProvider } from '../../../features/workTreeModel/components/WorkTimeProvider';
import { SpawnedFocusBody } from './SpawnedFocusBody';
import { SpawnedFocusFoot } from './SpawnedFocusFoot';
import { SpawnedLaunches } from './SpawnedLaunches';
import { SpawnedRunsLink } from './SpawnedRunsLink';
import { useSpawnedFocus } from './useSpawnedFocus';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const SpawnedPanel = ({ sessionId, onClose }: Props) => {
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const drawer = useAppStore((state) => state.drawer);
  const revealedAgentId =
    drawer?.kind === 'spawned' && drawer.sessionId === sessionId
      ? (drawer.payload?.agentId ?? null)
      : null;
  const mainAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
  const selectedAgentId = revealedAgentId ?? mainAgentId;
  const focus = useSpawnedFocus({ sessionId, revealedAgentId });
  if (session === null) {
    return null;
  }
  return (
    <DrawerFrame title="Agents" icon={CONCEPT_ICONS.agents} onClose={onClose}>
      <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
        <div
          data-spawned-panel={focus?.kind ?? 'live'}
          className="flex min-w-0 flex-col gap-2 px-2 pb-2"
        >
          {focus === null ? (
            <SpawnedLaunches session={session} selectedAgentId={selectedAgentId} />
          ) : (
            <>
              <SpawnedFocusBody session={session} focus={focus} selectedAgentId={selectedAgentId} />
              <SpawnedFocusFoot session={session} focus={focus} />
            </>
          )}
          <SpawnedRunsLink sessionId={sessionId} />
        </div>
      </WorkTimeProvider>
    </DrawerFrame>
  );
};
