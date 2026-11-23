import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { deskLandingOf } from '../deskLandingOf';

type Params = {
  readonly sessionId: SessionId;
};

export const useDeskOffReason = ({ sessionId }: Params): string | null =>
  useAppStore((state) => {
    const landing = deskLandingOf({ state, sessionId, door: 'desk', move: null, next: [] });
    return landing.face === 'overview' ? landing.reason : null;
  });
