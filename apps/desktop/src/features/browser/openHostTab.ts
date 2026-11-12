import type { SessionId, WorkspaceId } from '@goodboy/types';
import { browserHost } from './browserHost';
import type { BrowserBounds, BrowserTabFacts, BrowserTarget } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly target: BrowserTarget;
  readonly bounds: BrowserBounds;
};

export const openHostTab = ({
  sessionId,
  workspaceId,
  target,
  bounds,
}: Params): Promise<BrowserTabFacts> =>
  target.kind === 'local'
    ? browserHost.openLocal({ sessionId, workspaceId, path: target.path, bounds, isShown: false })
    : browserHost.open({ sessionId, workspaceId, url: target.url, bounds, isShown: false });
