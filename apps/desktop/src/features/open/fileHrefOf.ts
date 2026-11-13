type Params = {
  readonly href: string;
};

export type FileHref = {
  readonly path: string;
  readonly line: number | null;
};

const SCHEME_RE = /^[a-z][a-z\d+.-]*:/i;
const LINE_RE = /^L(\d+)(?:-L?\d+)?$/;
const FILE_SCHEME_RE = /^file:\/\/[^/]*/i;

type DecodeParams = {
  readonly value: string;
};

const decoded = ({ value }: DecodeParams): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const fileHrefOf = ({ href }: Params): FileHref | null => {
  const isFileScheme = /^file:/i.test(href);
  if (href === '' || href.startsWith('#') || href.startsWith('//')) {
    return null;
  }
  if (!isFileScheme && SCHEME_RE.test(href)) {
    return null;
  }
  const withoutScheme = isFileScheme ? href.replace(FILE_SCHEME_RE, '') : href;
  const hashIndex = withoutScheme.indexOf('#');
  const beforeHash = hashIndex === -1 ? withoutScheme : withoutScheme.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : withoutScheme.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf('?');
  const raw = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const path = decoded({ value: raw });
  if (path === '') {
    return null;
  }
  const match = LINE_RE.exec(fragment);
  return { path, line: match === null ? null : Number(match[1]) };
};
