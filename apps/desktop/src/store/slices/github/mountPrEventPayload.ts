import type { MountId, SessionEventPayload, SessionId } from '@goodboy/types';
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
  const mountPr =
    mountId === undefined
      ? null
      : ((state.mountGithub[mountId]?.prs ?? []).find((pr) => pr.number === number) ??
        state.mountGithub[mountId]?.pr ??
        null);
  return prEventPayload({ number, pr: mountPr ?? state.sessionGithub[sessionId]?.pr ?? null });
};
