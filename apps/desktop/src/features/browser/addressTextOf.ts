import { isFileAddress } from './isFileAddress';

type Params = {
  readonly url: string;
};

const DRIVE_PATHNAME = /^[/][a-z]:[/]/i;

export const addressTextOf = ({ url }: Params): string => {
  if (!isFileAddress({ url })) {
    return url;
  }
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return DRIVE_PATHNAME.test(path) ? path.slice(1) : path;
  } catch {
    return url;
  }
};
