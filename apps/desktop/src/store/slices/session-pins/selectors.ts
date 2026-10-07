import { useMemo } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { SessionPin } from './state';

const EMPTY_PINS: ReadonlyArray<SessionPin> = [];

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const useSessionPins = ({ workspaceId }: Params): ReadonlyArray<SessionPin> =>
  useAppStore((state) =>
    workspaceId === null ? EMPTY_PINS : (state.sessionPins[workspaceId] ?? EMPTY_PINS),
  );

export const usePinnedSessionIds = ({ workspaceId }: Params): ReadonlyArray<SessionId> => {
  const pins = useSessionPins({ workspaceId });
  return useMemo(() => pins.map((pin) => pin.id), [pins]);
};
