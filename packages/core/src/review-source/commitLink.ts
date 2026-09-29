import type { ReviewSourceKind } from './types';

const PULL_SUFFIX = /\/pull\/\d+(?:\/.*)?$/;
const MR_SUFFIX = /\/-\/merge_requests\/\d+(?:\/.*)?$/;
const BITBUCKET_SUFFIX = /\/pull-requests\/\d+(?:\/.*)?$/;

type Params = Readonly<{
  kind: ReviewSourceKind;
  url: string | null;
  sha: string;
}>;

const replaced = ({
  url,
  suffix,
  path,
}: {
  readonly url: string;
  readonly suffix: RegExp;
  readonly path: string;
}): string | null => {
  const next = url.replace(suffix, path);
  return next === url ? null : next;
};

export const commitLinkOf = ({ kind, url, sha }: Params): string | null => {
  if (url === null) {
    return null;
  }
  if (kind === 'github') {
    return replaced({ url, suffix: PULL_SUFFIX, path: `/commit/${sha}` });
  }
  if (kind === 'gitlab') {
    return replaced({ url, suffix: MR_SUFFIX, path: `/-/commit/${sha}` });
  }
  if (kind === 'bitbucket') {
    return replaced({ url, suffix: BITBUCKET_SUFFIX, path: `/commits/${sha}` });
  }
  return null;
};
