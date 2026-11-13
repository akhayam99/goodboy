type Params = {
  readonly url: string;
};

const FILE_SCHEME = 'file:';

export const isFileAddress = ({ url }: Params): boolean =>
  url.trim().toLowerCase().startsWith(FILE_SCHEME);
