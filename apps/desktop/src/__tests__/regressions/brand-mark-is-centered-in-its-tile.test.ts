import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { deflateSync, inflateSync } from 'zlib';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MASCOT_PNG = join(__dirname, '..', '..', 'assets', 'mascot.png');
const BRAND_BADGE = join(__dirname, '..', '..', 'app', 'components', 'AppTopBar', 'BrandBadge.tsx');
const DESKTOP_STYLES = join(__dirname, '..', '..', 'styles.css');
const DESKTOP_ICONS = join(__dirname, '..', '..', '..', 'src-tauri', 'icons');
const SITE_LOGO = join(REPOSITORY_ROOT, 'website', 'src', 'components', 'Logo.tsx');
const SITE_STYLES = join(REPOSITORY_ROOT, 'website', 'src', 'styles.css');
const FAVICON = join(REPOSITORY_ROOT, 'website', 'public', 'favicon.svg');
const BRAND_GENERATOR = join(REPOSITORY_ROOT, 'website', 'scripts', 'build-brand-assets.mjs');
const APP_ICON = 'icon.png';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_SIGNATURE_BYTES = 8;
const IHDR_END_BYTES = 29;
const CHUNK_HEADER_BYTES = 8;
const CHUNK_CRC_BYTES = 4;
const FILTER_BYTES_PER_ROW = 1;
const RGBA_BYTES_PER_PIXEL = 4;
const EIGHT_BIT_DEPTH = 8;
const RGBA_COLOR_TYPE = 6;
const NO_INTERLACE = 0;
const HALF_COVERAGE = 128;
const OPAQUE_FLOOR = 128;
const CENTER_TOLERANCE_PX = 0.5;

type Channels = {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
};

type Bounds = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

const paeth = ({
  left,
  up,
  upperLeft,
}: {
  left: number;
  up: number;
  upperLeft: number;
}): number => {
  const estimate = left + up - upperLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpperLeft = Math.abs(estimate - upperLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpperLeft) {
    return left;
  }
  if (distanceUp <= distanceUpperLeft) {
    return up;
  }
  return upperLeft;
};

const predict = ({
  filter,
  left,
  up,
  upperLeft,
}: {
  filter: number;
  left: number;
  up: number;
  upperLeft: number;
}): number => {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return Math.floor((left + up) / 2);
    case 4:
      return paeth({ left, up, upperLeft });
    default:
      throw new Error(`Unsupported PNG scanline filter ${filter}`);
  }
};

const readPixelData = ({
  source,
}: {
  source: Buffer;
}): { readonly width: number; readonly height: number; readonly pixels: Uint8Array } => {
  if (source.length < IHDR_END_BYTES) {
    throw new Error(`PNG is ${source.length} bytes, too short to carry a header`);
  }
  if (!source.subarray(0, PNG_SIGNATURE_BYTES).equals(PNG_SIGNATURE)) {
    throw new Error('File does not carry the PNG signature');
  }
  if (source.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('PNG does not open with an IHDR chunk');
  }
  const width = source.readUInt32BE(16);
  const height = source.readUInt32BE(20);
  const bitDepth = source.readUInt8(24);
  const colorType = source.readUInt8(25);
  const interlace = source.readUInt8(28);
  if (bitDepth !== EIGHT_BIT_DEPTH || colorType !== RGBA_COLOR_TYPE || interlace !== NO_INTERLACE) {
    throw new Error('This reader only handles 8-bit RGBA, non-interlaced PNG');
  }
  if (width === 0 || height === 0) {
    throw new Error(`PNG declares an empty canvas of ${width}x${height}`);
  }
  const parts: Buffer[] = [];
  let cursor = PNG_SIGNATURE_BYTES;
  while (cursor + CHUNK_HEADER_BYTES <= source.length) {
    const length = source.readUInt32BE(cursor);
    const type = source.toString('ascii', cursor + 4, cursor + 8);
    const payloadEnd = cursor + CHUNK_HEADER_BYTES + length;
    if (payloadEnd > source.length) {
      throw new Error(`PNG chunk "${type}" runs past the end of the file`);
    }
    if (type === 'IDAT') {
      parts.push(source.subarray(cursor + CHUNK_HEADER_BYTES, payloadEnd));
    }
    cursor = payloadEnd + CHUNK_CRC_BYTES;
  }
  if (parts.length === 0) {
    throw new Error('PNG carries no IDAT chunk');
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * RGBA_BYTES_PER_PIXEL;
  const expected = height * (FILTER_BYTES_PER_ROW + stride);
  if (raw.length !== expected) {
    throw new Error(
      `PNG payload is ${raw.length} bytes, expected ${expected} for ${width}x${height}`,
    );
  }
  const pixels = new Uint8Array(stride * height);
  const byteAt = (index: number): number => {
    const value = pixels[index];
    if (value === undefined) {
      throw new Error(`PNG scanline read out of range at byte ${index}`);
    }
    return value;
  };
  const rawAt = (index: number): number => {
    const value = raw[index];
    if (value === undefined) {
      throw new Error(`PNG payload read out of range at byte ${index}`);
    }
    return value;
  };
  let offset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = rawAt(offset);
    offset += FILTER_BYTES_PER_ROW;
    const lineStart = row * stride;
    const priorStart = (row - 1) * stride;
    for (let index = 0; index < stride; index += 1) {
      const left =
        index >= RGBA_BYTES_PER_PIXEL ? byteAt(lineStart + index - RGBA_BYTES_PER_PIXEL) : 0;
      const up = row === 0 ? 0 : byteAt(priorStart + index);
      const upperLeft =
        row === 0 || index < RGBA_BYTES_PER_PIXEL
          ? 0
          : byteAt(priorStart + index - RGBA_BYTES_PER_PIXEL);
      pixels[lineStart + index] =
        (rawAt(offset + index) + predict({ filter, left, up, upperLeft })) & 0xff;
    }
    offset += stride;
  }
  return { width, height, pixels };
};

const marginsOf = ({
  source,
  isInk,
}: {
  source: Buffer;
  isInk: (channels: Channels) => boolean;
}): Bounds => {
  const { width, height, pixels } = readPixelData({ source });
  const stride = width * RGBA_BYTES_PER_PIXEL;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const start = row * stride + column * RGBA_BYTES_PER_PIXEL;
      const channels = {
        red: pixels[start] ?? 0,
        green: pixels[start + 1] ?? 0,
        blue: pixels[start + 2] ?? 0,
        alpha: pixels[start + 3] ?? 0,
      };
      if (!isInk(channels)) {
        continue;
      }
      minX = Math.min(minX, column);
      maxX = Math.max(maxX, column);
      minY = Math.min(minY, row);
      maxY = Math.max(maxY, row);
    }
  }
  if (maxX === -1) {
    throw new Error('The mark has no ink');
  }
  return { left: minX, top: minY, right: width - 1 - maxX, bottom: height - 1 - maxY };
};

const inkMargins = ({ source }: { source: Buffer }): Bounds =>
  marginsOf({ source, isInk: ({ alpha }) => alpha > 0 });

const tileChannelsOf = ({ source }: { source: Buffer }): Channels => {
  const { pixels } = readPixelData({ source });
  return {
    red: pixels[0] ?? 0,
    green: pixels[1] ?? 0,
    blue: pixels[2] ?? 0,
    alpha: pixels[3] ?? 0,
  };
};

const tileColorOf = ({ source }: { source: Buffer }): string => {
  const { red, green, blue } = tileChannelsOf({ source });
  return [red, green, blue].reduce(
    (hex, channel) => `${hex}${channel.toString(16).padStart(2, '0')}`,
    '#',
  );
};

const markMarginsOf = ({ source }: { source: Buffer }): Bounds => {
  const tile = tileChannelsOf({ source });
  return marginsOf({
    source,
    isInk: ({ red, green, blue, alpha }) =>
      alpha > OPAQUE_FLOOR &&
      Math.max(Math.abs(red - tile.red), Math.abs(green - tile.green), Math.abs(blue - tile.blue)) >
        HALF_COVERAGE,
  });
};

const centerOffsetOf = ({ margins }: { margins: Bounds }): { x: number; y: number } => ({
  x: (margins.left - margins.right) / 2,
  y: (margins.top - margins.bottom) / 2,
});

const canvasWidthOf = ({ source }: { source: Buffer }): number => readPixelData({ source }).width;

const inkWidthRatioOf = ({ source }: { source: Buffer }): number => {
  const width = canvasWidthOf({ source });
  const margins = markMarginsOf({ source });
  return (width - margins.left - margins.right) / width;
};

const cssValueOf = ({ path, variableName }: { path: string; variableName: string }): string => {
  const match = new RegExp(`${variableName}:\\s*([^;]+);`).exec(readFileSync(path, 'utf8'));
  if (match === null) {
    throw new Error(`${path} must declare ${variableName}`);
  }
  return (match[1] ?? '').trim();
};

const numberAttribute = ({
  source,
  tag,
  attribute,
}: {
  source: string;
  tag: string;
  attribute: string;
}): number => {
  const element = new RegExp(`<${tag}\\s[^>]*>`).exec(source);
  if (element === null) {
    throw new Error(`favicon.svg must carry a <${tag}> element`);
  }
  const match = new RegExp(`${attribute}="([\\d.]+)"`).exec(element[0]);
  if (match === null) {
    throw new Error(`The <${tag}> element must carry ${attribute}`);
  }
  return Number(match[1]);
};

const ratioOf = ({ source, name }: { source: string; name: string }): number => {
  const match = new RegExp(`const ${name} = ([\\d.]+);`).exec(source);
  if (match === null) {
    throw new Error(`The source must declare ${name}`);
  }
  return Number(match[1]);
};

const chunk = ({ type, payload }: { type: string; payload: Buffer }): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  return Buffer.concat([
    length,
    Buffer.from(type, 'ascii'),
    payload,
    Buffer.alloc(CHUNK_CRC_BYTES),
  ]);
};

const buildPng = ({
  width,
  height,
  scanlines,
  colorType = RGBA_COLOR_TYPE,
  bitDepth = EIGHT_BIT_DEPTH,
}: {
  width: number;
  height: number;
  scanlines: Buffer;
  colorType?: number;
  bitDepth?: number;
}): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(bitDepth, 8);
  header.writeUInt8(colorType, 9);
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk({ type: 'IHDR', payload: header }),
    chunk({ type: 'IDAT', payload: deflateSync(scanlines) }),
    chunk({ type: 'IEND', payload: Buffer.alloc(0) }),
  ]);
};

const fullScanlines = ({ width, height }: { width: number; height: number }): Buffer =>
  Buffer.alloc(height * (FILTER_BYTES_PER_ROW + width * RGBA_BYTES_PER_PIXEL));

const BADGE_SOURCE = readFileSync(BRAND_BADGE, 'utf8');
const LOGO_SOURCE = readFileSync(SITE_LOGO, 'utf8');
const FAVICON_SOURCE = readFileSync(FAVICON, 'utf8');
const MARK_SCALE = ratioOf({ source: BADGE_SOURCE, name: 'MARK_SCALE' });
const TILE_RADIUS = ratioOf({ source: BADGE_SOURCE, name: 'TILE_RADIUS' });
const DESKTOP_TILE = cssValueOf({ path: DESKTOP_STYLES, variableName: '--color-brand' });
const SITE_TILE = cssValueOf({ path: SITE_STYLES, variableName: '--brand-tile' });
const ICON_FILES = readdirSync(DESKTOP_ICONS).filter((name) => name.endsWith('.png'));
const GENERATOR_SOURCE = readFileSync(BRAND_GENERATOR, 'utf8');
const APP_ICON_SCALE = ratioOf({
  source: GENERATOR_SOURCE,
  name: 'APP_ICON_MARK_SCALE_EXCEPTION',
});
const MASCOT_MARGINS = inkMargins({ source: readFileSync(MASCOT_PNG) });
const MASCOT_CANVAS_PX = canvasWidthOf({ source: readFileSync(MASCOT_PNG) });
const MASCOT_INK_RATIO =
  (MASCOT_CANVAS_PX - MASCOT_MARGINS.left - MASCOT_MARGINS.right) / MASCOT_CANVAS_PX;

describe('the reader behind these measurements', () => {
  it('decodes a canvas it built itself, so the checks below mean something', () => {
    const { width, height, pixels } = readPixelData({
      source: buildPng({ width: 3, height: 2, scanlines: fullScanlines({ width: 3, height: 2 }) }),
    });
    expect([width, height]).toEqual([3, 2]);
    expect(pixels).toHaveLength(3 * 2 * RGBA_BYTES_PER_PIXEL);
  });

  it('refuses a payload that inflates short instead of padding it with zeros', () => {
    const short = fullScanlines({ width: 4, height: 4 }).subarray(0, 30);
    expect(() =>
      readPixelData({ source: buildPng({ width: 4, height: 4, scanlines: short }) }),
    ).toThrow('PNG payload is 30 bytes, expected 68 for 4x4');
  });

  it('refuses a payload that inflates long', () => {
    const long = fullScanlines({ width: 4, height: 5 });
    expect(() =>
      readPixelData({ source: buildPng({ width: 4, height: 4, scanlines: long }) }),
    ).toThrow('PNG payload is 85 bytes, expected 68 for 4x4');
  });

  it('refuses a chunk whose declared length runs past the end of the file', () => {
    const png = buildPng({
      width: 2,
      height: 2,
      scanlines: fullScanlines({ width: 2, height: 2 }),
    });
    const idatPayloadStart = png.indexOf('IDAT', 0, 'ascii') + 4;
    expect(() => readPixelData({ source: png.subarray(0, idatPayloadStart + 2) })).toThrow(
      'PNG chunk "IDAT" runs past the end of the file',
    );
  });

  it('refuses a file that is not a PNG and one that carries no IDAT', () => {
    expect(() => readPixelData({ source: Buffer.alloc(64) })).toThrow(
      'does not carry the PNG signature',
    );
    const withoutPixels = Buffer.concat([
      PNG_SIGNATURE,
      chunk({ type: 'IHDR', payload: Buffer.alloc(13) }),
    ]);
    withoutPixels.writeUInt32BE(2, 16);
    withoutPixels.writeUInt32BE(2, 20);
    withoutPixels.writeUInt8(EIGHT_BIT_DEPTH, 24);
    withoutPixels.writeUInt8(RGBA_COLOR_TYPE, 25);
    expect(() => readPixelData({ source: withoutPixels })).toThrow('carries no IDAT chunk');
  });

  it('refuses formats it cannot actually decode rather than guessing', () => {
    expect(() =>
      readPixelData({
        source: buildPng({
          width: 2,
          height: 2,
          scanlines: fullScanlines({ width: 2, height: 2 }),
          colorType: 2,
        }),
      }),
    ).toThrow('only handles 8-bit RGBA');
    expect(() =>
      readPixelData({
        source: buildPng({
          width: 2,
          height: 2,
          scanlines: fullScanlines({ width: 2, height: 2 }),
          bitDepth: 16,
        }),
      }),
    ).toThrow('only handles 8-bit RGBA');
  });

  it('refuses a scanline filter it does not implement', () => {
    const scanlines = fullScanlines({ width: 2, height: 1 });
    scanlines.writeUInt8(9, 0);
    expect(() => readPixelData({ source: buildPng({ width: 2, height: 1, scanlines }) })).toThrow(
      'Unsupported PNG scanline filter 9',
    );
  });
});

describe('brand mark is centered in its tile', () => {
  it('ships a mascot whose ink is symmetric inside its own canvas', () => {
    const margins = inkMargins({ source: readFileSync(MASCOT_PNG) });
    expect(margins.left).toBe(margins.right);
    expect(margins.top).toBe(margins.bottom);
  });

  it('centers the top bar mark with the box model, never a hand-tuned offset', () => {
    expect(BADGE_SOURCE).toContain('items-center justify-center');
    expect(BADGE_SOURCE).not.toContain('absolute');
    expect(BADGE_SOURCE).not.toMatch(/MARK_(LEFT|TOP)/);
  });

  it('centers the site mark the same way the top bar does', () => {
    expect(LOGO_SOURCE).not.toContain('absolute');
    expect(LOGO_SOURCE).not.toMatch(/MARK_(LEFT|TOP)/);
    expect(ratioOf({ source: LOGO_SOURCE, name: 'MARK_SCALE' })).toBe(MARK_SCALE);
    expect(ratioOf({ source: LOGO_SOURCE, name: 'TILE_RADIUS' })).toBe(TILE_RADIUS);
  });

  it('lands the favicon glyph box on the center of its own canvas', () => {
    const canvas = numberAttribute({ source: FAVICON_SOURCE, tag: 'rect', attribute: 'width' });
    const markSize = numberAttribute({ source: FAVICON_SOURCE, tag: 'image', attribute: 'width' });
    const markHeight = numberAttribute({
      source: FAVICON_SOURCE,
      tag: 'image',
      attribute: 'height',
    });
    const left = numberAttribute({ source: FAVICON_SOURCE, tag: 'image', attribute: 'x' });
    const top = numberAttribute({ source: FAVICON_SOURCE, tag: 'image', attribute: 'y' });
    expect(markSize).toBe(markHeight);
    expect(markSize / canvas).toBeCloseTo(MARK_SCALE, 10);
    expect(
      numberAttribute({ source: FAVICON_SOURCE, tag: 'rect', attribute: 'rx' }) / canvas,
    ).toBeCloseTo(TILE_RADIUS, 10);
    expect(left).toBeCloseTo((canvas - markSize) / 2, 10);
    expect(top).toBeCloseTo((canvas - markHeight) / 2, 10);
  });

  it('embeds a favicon glyph that is itself symmetric, so the box center is the ink center', () => {
    const glyph = /base64,([A-Za-z0-9+/=]+)/.exec(FAVICON_SOURCE)?.[1];
    if (glyph === undefined) {
      throw new Error('favicon.svg must embed a base64 PNG glyph');
    }
    const margins = inkMargins({ source: Buffer.from(glyph, 'base64') });
    expect(margins.left).toBe(margins.right);
    expect(margins.top).toBe(margins.bottom);
  });

  it('paints one black tile on the app, the site and the favicon', () => {
    expect(DESKTOP_TILE).toMatch(/^#[0-9a-f]{6}$/);
    expect(SITE_TILE).toBe(DESKTOP_TILE);
    expect(BADGE_SOURCE).toContain('bg-brand');
    expect(FAVICON_SOURCE).toContain(`fill="${DESKTOP_TILE}"`);
  });

  it('centers the mark on every desktop icon and keeps them on the brand tile', () => {
    expect(ICON_FILES.length).toBeGreaterThan(0);
    const offCenter = ICON_FILES.filter((name) => {
      const margins = markMarginsOf({ source: readFileSync(join(DESKTOP_ICONS, name)) });
      const offset = centerOffsetOf({ margins });
      return Math.abs(offset.x) > CENTER_TOLERANCE_PX || Math.abs(offset.y) > CENTER_TOLERANCE_PX;
    });
    expect(offCenter).toEqual([]);
    const offBrand = ICON_FILES.filter(
      (name) => tileColorOf({ source: readFileSync(join(DESKTOP_ICONS, name)) }) !== DESKTOP_TILE,
    );
    expect(offBrand).toEqual([]);
  });

  it('gives the app icon its own scale and leaves the shared ratio to the rest', () => {
    expect(APP_ICON_SCALE).toBeLessThan(MARK_SCALE);
    expect(GENERATOR_SOURCE).toContain(`APP_ICON_PX * APP_ICON_MARK_SCALE_EXCEPTION`);
    const measured = inkWidthRatioOf({ source: readFileSync(join(DESKTOP_ICONS, APP_ICON)) });
    expect(measured).toBeCloseTo(APP_ICON_SCALE * MASCOT_INK_RATIO, 1);
    expect(measured).not.toBeCloseTo(MARK_SCALE * MASCOT_INK_RATIO, 1);
  });
});
