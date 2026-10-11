import type { SessionId } from '@goodboy/types';
import type { StudioPlace } from '../../store';

type PlaceParams = {
  readonly sessionId: SessionId | null;
};

export const terminalStudioPlace = ({ sessionId }: PlaceParams): StudioPlace => ({
  kind: 'terminal',
  terminalId: null,
  sessionId,
});
