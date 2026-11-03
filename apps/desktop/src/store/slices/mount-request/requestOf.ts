import type { MountId, SessionId } from '@goodboy/types';
import type {
  MountBitbucketPrState,
  MountGitlabMrState,
  MountRequestSliceState,
  SessionBitbucketPrEntry,
  SessionGitlabMrState,
} from './state';

type MountParams = {
  readonly state: Partial<Pick<MountRequestSliceState, 'mountRequests'>>;
  readonly mountId: MountId;
};

type MountsParams = {
  readonly state: Partial<Pick<MountRequestSliceState, 'mountRequests'>>;
};

type SessionParams = {
  readonly state: Partial<Pick<MountRequestSliceState, 'sessionRequests'>>;
  readonly sessionId: SessionId | null | undefined;
};

export const gitlabMountOf = ({ state, mountId }: MountParams): MountGitlabMrState | undefined => {
  const entry = state.mountRequests?.[mountId];
  return entry?.kind === 'gitlab' ? entry : undefined;
};

export const bitbucketMountOf = ({
  state,
  mountId,
}: MountParams): MountBitbucketPrState | undefined => {
  const entry = state.mountRequests?.[mountId];
  return entry?.kind === 'bitbucket' ? entry : undefined;
};

export const gitlabMountsOf = ({ state }: MountsParams): ReadonlyArray<MountGitlabMrState> =>
  Object.values(state.mountRequests ?? {}).flatMap((entry) =>
    entry.kind === 'gitlab' ? [entry] : [],
  );

export const bitbucketMountsOf = ({ state }: MountsParams): ReadonlyArray<MountBitbucketPrState> =>
  Object.values(state.mountRequests ?? {}).flatMap((entry) =>
    entry.kind === 'bitbucket' ? [entry] : [],
  );

export const gitlabSessionOf = ({
  state,
  sessionId,
}: SessionParams): SessionGitlabMrState | undefined => {
  const entry = sessionId == null ? undefined : state.sessionRequests?.[sessionId];
  return entry?.kind === 'gitlab' ? entry : undefined;
};

export const bitbucketSessionOf = ({
  state,
  sessionId,
}: SessionParams): SessionBitbucketPrEntry | undefined => {
  const entry = sessionId == null ? undefined : state.sessionRequests?.[sessionId];
  return entry?.kind === 'bitbucket' ? entry : undefined;
};
