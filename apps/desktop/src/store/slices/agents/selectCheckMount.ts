import type { MountId } from '@goodboy/types';

type MountChecks = {
  readonly mountId: MountId;
  readonly prs: ReadonlyArray<{ readonly url: string }>;
  readonly detail: {
    readonly checks: ReadonlyArray<{ readonly detailsUrl: string | null }>;
  } | null;
};

type Params = {
  readonly state: { readonly mountGithub: Readonly<Record<MountId, MountChecks>> };
  readonly url: string;
};

export const selectCheckMount = ({ state, url }: Params): MountId | null => {
  for (const mount of Object.values(state.mountGithub)) {
    const isPrUrl = mount.prs.some((pr) => pr.url === url);
    const isCheckUrl = (mount.detail?.checks ?? []).some((check) => check.detailsUrl === url);
    if (isPrUrl || isCheckUrl) {
      return mount.mountId;
    }
  }
  return null;
};
