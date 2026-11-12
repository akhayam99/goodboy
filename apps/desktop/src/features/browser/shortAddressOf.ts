import { hostOf } from './hostOf';

type Params = {
  readonly url: string;
};

export const shortAddressOf = ({ url }: Params): string => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${hostOf({ url })}${path}${parsed.search}`;
  } catch {
    return url;
  }
};
