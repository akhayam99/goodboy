import type { SessionId } from '@goodboy/types';
import type { StudioPlace } from '../../store';

type PlaceParams = {
  readonly sessionId: SessionId | null;
};

export const browserStudioPlace = ({ sessionId }: PlaceParams): StudioPlace => ({
  kind: 'browser',
  sessionId,
  tabId: null,
});
