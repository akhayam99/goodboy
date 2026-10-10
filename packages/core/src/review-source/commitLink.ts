import { HOST_CAPABILITIES, isHostKind } from './hostCapabilities';
import type { ReviewSourceKind } from './types';

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
  if (url === null || !isHostKind(kind)) {
    return null;
  }
  const row = HOST_CAPABILITIES[kind];
  return replaced({
    url,
    suffix: row.requestSegment,
    path: `${row.commitSegment}${sha}`,
  });
};
