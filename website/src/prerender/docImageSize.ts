import sizes from './imageSizes.json';
import type { ImageSize } from './themePictures';

const MEDIA_ROOT = 'https://raw.githubusercontent.com/akhayam99/goodboy-media/main/';
const SIZES: Readonly<Record<string, ImageSize>> = sizes;

type Params = {
  readonly src: string;
};

export const docImageSize = ({ src }: Params): ImageSize | null => {
  if (!src.startsWith(MEDIA_ROOT)) {
    return null;
  }
  const path = src.slice(MEDIA_ROOT.length);
  return Object.hasOwn(SIZES, path) ? SIZES[path] : null;
};
