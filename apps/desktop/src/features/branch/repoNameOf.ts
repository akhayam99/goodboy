const PULL_REQUEST_URL = /^https?:\/\/[^/]+\/[^/]+\/([^/]+)\/pull\/\d+/;

const MERGE_REQUEST_URL = /^https?:\/\/[^/]+\/(?:.+\/)?([^/]+)\/-\/merge_requests\/\d+/;

const FALLBACK_NAME = 'this repository';

type Params = {
  readonly url: string;
};

export const repoNameOf = ({ url }: Params): string =>
  PULL_REQUEST_URL.exec(url)?.[1] ?? MERGE_REQUEST_URL.exec(url)?.[1] ?? FALLBACK_NAME;
