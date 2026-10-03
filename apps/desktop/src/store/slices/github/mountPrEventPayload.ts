import type { MountId, SessionEventPayload, SessionId } from '@goodboy/types';
import { githubRequestHost } from './mountPrLink';
import { prEventPayload } from './prEventPayload';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId | undefined;
  readonly number: number;
};

export const mountPrEventPayload = ({
  get,
  sessionId,
  mountId,
  number,
}: Params): SessionEventPayload => {
  const state = get();
  const mount = mountId === undefined ? undefined : state.mountGithub[mountId];
  const mountPr =
    mount === undefined ? null : (mount.prs.find((pr) => pr.number === number) ?? mount.pr ?? null);
  const base = prEventPayload({
    number,
    pr: mountPr ?? state.sessionGithub[sessionId]?.pr ?? null,
  });
  if (mountId === undefined || mount === undefined || mount.repository == null) {
    return base;
  }
  const url = typeof base.url === 'string' ? base.url : null;
  return {
    mountId,
    provider: 'github',
    host: mount.host ?? (url === null ? 'github.com' : githubRequestHost({ url })),
    repository: mount.repository,
    ...base,
  };
};
