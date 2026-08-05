import type { SessionId } from '@goodboy/types';
import type { DiffFocus } from './types';

export type OpenDiffViewerEventDetail = {
  readonly sessionId?: SessionId;
};

export type OpenDiffViewerEventResolution = {
  readonly sessionId: SessionId;
  readonly focus: DiffFocus;
};

export const resolveOpenDiffViewerEvent = ({
  detail,
}: {
  readonly detail: OpenDiffViewerEventDetail | undefined;
}): OpenDiffViewerEventResolution | null => {
  if (detail?.sessionId == null) {
    return null;
  }
  return { sessionId: detail.sessionId, focus: { kind: 'working', path: null } };
};
