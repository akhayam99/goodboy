import { readFileSync } from 'fs';
import { join } from 'path';
import { inflateSync } from 'zlib';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MASCOT_PNG = join(__dirname, '..', '..', 'assets', 'mascot.png');
const BRAND_BADGE = join(__dirname, '..', '..', 'app', 'components', 'AppTopBar', 'BrandBadge.tsx');
const SITE_LOGO = join(REPOSITORY_ROOT, 'website', 'src', 'components', 'Logo.tsx');
const FAVICON = join(REPOSITORY_ROOT, 'website', 'public', 'favicon.svg');

const PNG_SIGNATURE_BYTES = 8;
const CHUNK_HEADER_BYTES = 8;
const CHUNK_CRC_BYTES = 4;
const RGBA_BYTES_PER_PIXEL = 4;
const EIGHT_BIT_DEPTH = 8;
const RGBA_COLOR_TYPE = 6;
const NO_INTERLACE = 0;

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
  const width = source.readUInt32BE(16);
  const height = source.readUInt32BE(20);
  const bitDepth = source.readUInt8(24);
  const colorType = source.readUInt8(25);
  const interlace = source.readUInt8(28);
  if (bitDepth !== EIGHT_BIT_DEPTH || colorType !== RGBA_COLOR_TYPE || interlace !== NO_INTERLACE) {
    throw new Error('This reader only handles 8-bit RGBA, non-interlaced PNG');
  }
  const parts: Buffer[] = [];
  let cursor = PNG_SIGNATURE_BYTES;
  while (cursor < source.length) {
    const length = source.readUInt32BE(cursor);
    const type = source.toString('ascii', cursor + 4, cursor + 8);
    if (type === 'IDAT') {
      parts.push(
        source.subarray(cursor + CHUNK_HEADER_BYTES, cursor + CHUNK_HEADER_BYTES + length),
      );
    }
    cursor += CHUNK_HEADER_BYTES + length + CHUNK_CRC_BYTES;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * RGBA_BYTES_PER_PIXEL;
  const pixels = new Uint8Array(stride * height);
  const byteAt = (index: number): number => pixels[index] ?? 0;
  let offset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[offset] ?? 0;
    offset += 1;
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
        ((raw[offset + index] ?? 0) + predict({ filter, left, up, upperLeft })) & 0xff;
    }
    offset += stride;
  }
  return { width, height, pixels };
};

const inkMargins = ({ source }: { source: Buffer }): Bounds => {
  const { width, height, pixels } = readPixelData({ source });
  const stride = width * RGBA_BYTES_PER_PIXEL;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const alpha = pixels[row * stride + column * RGBA_BYTES_PER_PIXEL + 3] ?? 0;
      if (alpha === 0) {
        continue;
      }
      minX = Math.min(minX, column);
      maxX = Math.max(maxX, column);
      minY = Math.min(minY, row);
      maxY = Math.max(maxY, row);
    }
  }
  if (maxX === -1) {
    throw new Error('The mark has no opaque pixels');
  }
  return { left: minX, top: minY, right: width - 1 - maxX, bottom: height - 1 - maxY };
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

const BADGE_SOURCE = readFileSync(BRAND_BADGE, 'utf8');
const LOGO_SOURCE = readFileSync(SITE_LOGO, 'utf8');
const FAVICON_SOURCE = readFileSync(FAVICON, 'utf8');
const MARK_SCALE = ratioOf({ source: BADGE_SOURCE, name: 'MARK_SCALE' });
const TILE_RADIUS = ratioOf({ source: BADGE_SOURCE, name: 'TILE_RADIUS' });

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
});
