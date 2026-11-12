import { addressTextOf } from './addressTextOf';
import { isFileAddress } from './isFileAddress';

type Params = {
  readonly url: string;
};

export const hostOf = ({ url }: Params): string => {
  if (isFileAddress({ url })) {
    return addressTextOf({ url }).split('/').pop() ?? url;
  }
  try {
    const host = new URL(url).host;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return url;
  }
};
