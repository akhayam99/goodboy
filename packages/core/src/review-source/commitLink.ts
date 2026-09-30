import type { ReviewSourceKind } from './types';

const PULL_SUFFIX = '/pull/';
const MR_SUFFIX = '/-/merge_requests/';
const BITBUCKET_SUFFIX = '/pull-requests/';
const DIGIT = /\d/;

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
  readonly suffix: string;
  readonly path: string;
}): string | null => {
  let start = url.indexOf(suffix);
  while (start !== -1) {
    let end = start + suffix.length;
    while (end < url.length && DIGIT.test(url[end] ?? '')) {
      end += 1;
    }
    if (end > start + suffix.length && (end === url.length || url[end] === '/')) {
      return `${url.slice(0, start)}${path}`;
    }
    start = url.indexOf(suffix, start + 1);
  }
  return null;
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
