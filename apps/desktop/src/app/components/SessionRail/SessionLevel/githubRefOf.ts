type Params = {
  readonly url: string;
};

const REF_TAIL = /\/([^/]+)\/([^/]+)\/(?:pull|issues)\/(\d+)\/?$/;

export const githubRefOf = ({ url }: Params): string | null => {
  const match = REF_TAIL.exec(url);
  if (match === null) {
    return null;
  }
  return `${match[1]}/${match[2]}#${match[3]}`;
};
