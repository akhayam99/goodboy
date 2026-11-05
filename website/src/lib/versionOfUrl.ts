const VERSION_IN_URL = new RegExp('/download/v(\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?)/');

type Params = {
  readonly url: string;
};

export const versionOfUrl = ({ url }: Params) => VERSION_IN_URL.exec(url)?.[1] ?? null;
