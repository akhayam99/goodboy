import { useState } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { OpenDrawer } from '../../../store/slices/drawer/state';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { WorkTimeProvider } from '../../../features/workTreeModel/components/WorkTimeProvider';
import { SpawnedFocusBody } from './SpawnedFocusBody';
import { SpawnedFocusFoot } from './SpawnedFocusFoot';
import { SpawnedLaunches } from './SpawnedLaunches';
import { spawnedFocusKeyOf } from './spawnedFocusKeyOf';
import { useSpawnedFocus } from './useSpawnedFocus';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

type ListedFocus = {
  readonly key: string | null;
  readonly drawer: OpenDrawer | null;
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
  const focusKey = spawnedFocusKeyOf({ focus });
  const [listedFor, setListedFor] = useState<ListedFocus | null>(null);
  const shown =
    focusKey !== null && listedFor?.key === focusKey && listedFor.drawer === drawer ? null : focus;
  if (session === null) {
    return null;
  }
  return (
    <DrawerFrame
      title="Agents"
      icon={CONCEPT_ICONS.agents}
      onClose={onClose}
      {...(shown !== null && {
        back: { label: 'All launches', onBack: () => setListedFor({ key: focusKey, drawer }) },
      })}
    >
      <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
        <div
          data-spawned-panel={shown?.kind ?? 'all'}
          className="flex min-w-0 flex-col gap-2 px-2 pb-2"
        >
          {shown === null ? (
            <SpawnedLaunches session={session} selectedAgentId={selectedAgentId} />
          ) : (
            <>
              <SpawnedFocusBody session={session} focus={shown} selectedAgentId={selectedAgentId} />
              <SpawnedFocusFoot session={session} focus={shown} />
            </>
          )}
        </div>
      </WorkTimeProvider>
    </DrawerFrame>
  );
};
