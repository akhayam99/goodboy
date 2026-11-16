import type { Rgb } from './colorMath';

const BLACK_THRESHOLD = 0.022;
const BLACK_CLAMP = 1.414;
const DELTA_Y_MIN = 0.0005;
const SCALE = 1.14;
const LOW_CLIP = 0.1;
const LOW_OFFSET = 0.027;

type LuminanceParams = { readonly rgb: Rgb };

const screenLuminance = ({ rgb }: LuminanceParams): number => {
  const y = 0.2126729 * rgb[0] ** 2.4 + 0.7151522 * rgb[1] ** 2.4 + 0.072175 * rgb[2] ** 2.4;
  return y > BLACK_THRESHOLD ? y : y + (BLACK_THRESHOLD - y) ** BLACK_CLAMP;
};

type ApcaContrastParams = { readonly text: Rgb; readonly background: Rgb };

export const apcaContrast = ({ text, background }: ApcaContrastParams): number => {
  const textY = screenLuminance({ rgb: text });
  const backgroundY = screenLuminance({ rgb: background });
  if (Math.abs(backgroundY - textY) < DELTA_Y_MIN) {
    return 0;
  }
  if (backgroundY > textY) {
    const darkOnLight = (backgroundY ** 0.56 - textY ** 0.57) * SCALE;
    return darkOnLight < LOW_CLIP ? 0 : (darkOnLight - LOW_OFFSET) * 100;
  }
  const lightOnDark = (backgroundY ** 0.65 - textY ** 0.62) * SCALE;
  return lightOnDark > -LOW_CLIP ? 0 : (lightOnDark + LOW_OFFSET) * 100;
};
