import { isFileAddress } from './isFileAddress';

type Params = {
  readonly url: string;
};

export const addressTextOf = ({ url }: Params): string => {
  if (!isFileAddress({ url })) {
    return url;
  }
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url;
  }
};
