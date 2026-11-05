import { requireMatch } from './requireMatch.mjs';

const encodeSrgbChannel = (value) => {
  const clamped = Math.min(1, Math.max(0, value));
  const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255)
    .toString(16)
    .padStart(2, '0');
};

const oklchToHex = ({ lightness, chroma, hue }) => {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.29148555 * b) ** 3;
  const red = 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short;
  const green = -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short;
  const blue = -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short;
  return `#${encodeSrgbChannel(red)}${encodeSrgbChannel(green)}${encodeSrgbChannel(blue)}`;
};

export const toHexColor = (color) => {
  if (color.startsWith('#')) {
    return color;
  }
  const match = requireMatch({
    source: color,
    pattern: /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/,
    description: `a hex or oklch color, received "${color}"`,
  });
  return oklchToHex({
    lightness: Number(match[1]),
    chroma: Number(match[2]),
    hue: Number(match[3]),
  });
};
