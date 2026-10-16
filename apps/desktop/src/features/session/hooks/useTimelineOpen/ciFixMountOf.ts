import type { MountId, SessionId, SessionMountView } from '@goodboy/types';
import {
  selectCheckMount,
  type CheckMountState,
} from '../../../../store/slices/agents/selectCheckMount';

type CiFixMountState = CheckMountState & {
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
};

type Params = {
  readonly state: CiFixMountState;
  readonly sessionId: SessionId;
  readonly checkUrl: string;
  readonly storedMountId?: MountId | undefined;
};

type JobUrlParams = {
  readonly url: string;
};

const repoSlugOfJobUrl = ({ url }: JobUrlParams): string | null => {
  if (!URL.canParse(url)) {
    return null;
  }
  const [owner, repo, section] = new URL(url).pathname.split('/').filter((part) => part !== '');
  if (owner === undefined || repo === undefined || section !== 'actions') {
    return null;
  }
  return `${owner}/${repo}`.toLowerCase();
};

export const ciFixMountOf = ({
  state,
  sessionId,
  checkUrl,
  storedMountId,
}: Params): MountId | null => {
  const attached = (state.sessionMounts[sessionId] ?? []).filter((mount) => mount.isAttached);
  if (storedMountId !== undefined && attached.some((mount) => mount.id === storedMountId)) {
    return storedMountId;
  }
  const loaded = selectCheckMount({ state, url: checkUrl });
  if (loaded !== null) {
    return loaded;
  }
  const slug = repoSlugOfJobUrl({ url: checkUrl });
  if (slug !== null) {
    const sameRepo = attached.filter((mount) => mount.repoSlug?.toLowerCase() === slug);
    if (sameRepo.length === 1) {
      return sameRepo[0]?.id ?? null;
    }
    if (sameRepo.length > 1) {
      return null;
    }
  }
  if (attached.length === 1) {
    return attached[0]?.id ?? null;
  }
  return null;
};
