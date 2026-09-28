import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { brotliDecompressSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import { INTER_FONT_DATA_URI } from '../../features/artifacts/artifactMirror/interFontDataUri';

const SRC = join(__dirname, '..', '..');
const STYLES_PATH = join(SRC, 'styles.css');
const FONT_PATH = join(SRC, 'assets', 'fonts', 'InterVariable-latin.woff2');
const styles = readFileSync(STYLES_PATH, 'utf8');

const WOFF2_KNOWN_TAGS = [
  'cmap',
  'head',
  'hhea',
  'hmtx',
  'maxp',
  'name',
  'OS/2',
  'post',
  'cvt ',
  'fpgm',
  'glyf',
  'loca',
  'prep',
  'CFF ',
  'VORG',
  'EBDT',
  'EBLC',
  'gasp',
  'hdmx',
  'kern',
  'LTSH',
  'PCLT',
  'VDMX',
  'vhea',
  'vmtx',
  'BASE',
  'GDEF',
  'GPOS',
  'GSUB',
  'EBSC',
  'JSTF',
  'MATH',
  'CBDT',
  'CBLC',
  'COLR',
  'CPAL',
  'SVG ',
  'sbix',
  'acnt',
  'avar',
  'bdat',
  'bloc',
  'bsln',
  'cvar',
  'fdsc',
  'feat',
  'fmtx',
  'fvar',
  'gvar',
  'hsty',
  'just',
  'lcar',
  'mort',
  'morx',
  'opbd',
  'prop',
  'trak',
  'Zapf',
  'Silf',
  'Glat',
  'Gloc',
  'Feat',
  'Sill',
];

const cssFiles = ({ directory }: { readonly directory: string }): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return cssFiles({ directory: path });
    }
    return path.endsWith('.css') ? [path] : [];
  });

const fontFaces = ({ css }: { readonly css: string }): readonly string[] =>
  [...css.matchAll(/@font-face \{([^}]*)\}/g)].map((match) => String(match[1]));

const themeFontSans = (): string => {
  const match = /@theme \{[\s\S]*?--font-sans:\s*([^;]+);/.exec(styles);
  if (match === null) {
    throw new Error('styles.css must declare --font-sans in @theme');
  }
  return String(match[1]).replace(/\s+/g, ' ').trim();
};

const bodyFeatureTags = (): readonly string[] => {
  const match = /\nbody \{[^}]*font-feature-settings:([^;]+);/.exec(styles);
  if (match === null) {
    throw new Error('styles.css must declare font-feature-settings on body');
  }
  return [...String(match[1]).matchAll(/'([a-z0-9]{4})'/g)].map((tag) => String(tag[1]));
};

const woff2Tables = ({ font }: { readonly font: Buffer }): ReadonlyMap<string, Buffer> => {
  const tableCount = font.readUInt16BE(12);
  const compressedLength = font.readUInt32BE(20);
  let offset = 48;
  const readBase128 = (): number => {
    let value = 0;
    for (let step = 0; step < 5; step += 1) {
      const byte = font.readUInt8(offset);
      offset += 1;
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) {
        return value;
      }
    }
    throw new Error('woff2 base128 value is longer than five bytes');
  };
  const entries = Array.from({ length: tableCount }, () => {
    const flags = font.readUInt8(offset);
    offset += 1;
    const known = WOFF2_KNOWN_TAGS[flags & 0x3f];
    const tag = known ?? font.toString('latin1', offset, offset + 4);
    if (known === undefined) {
      offset += 4;
    }
    const originalLength = readBase128();
    const version = (flags >> 6) & 0x3;
    const isGlyphTable = tag === 'glyf' || tag === 'loca';
    const isTransformed = isGlyphTable ? version === 0 : version !== 0;
    const length = isTransformed ? readBase128() : originalLength;
    return { tag, length };
  });
  const data = brotliDecompressSync(font.subarray(offset, offset + compressedLength));
  let cursor = 0;
  return new Map(
    entries.map(({ tag, length }) => {
      const table = data.subarray(cursor, cursor + length);
      cursor += length;
      return [tag, table] as const;
    }),
  );
};

const layoutFeatures = ({ table }: { readonly table: Buffer | undefined }): readonly string[] => {
  if (table === undefined) {
    return [];
  }
  const listOffset = table.readUInt16BE(6);
  const count = table.readUInt16BE(listOffset);
  return Array.from({ length: count }, (_, index) =>
    table.toString('latin1', listOffset + 2 + index * 6, listOffset + 6 + index * 6),
  );
};

const sha256 = ({ bytes }: { readonly bytes: Buffer }): string =>
  createHash('sha256').update(bytes).digest('hex');

describe('the app is set in Inter', () => {
  const interFaces = cssFiles({ directory: SRC })
    .flatMap((path) =>
      fontFaces({ css: readFileSync(path, 'utf8') }).map((face) => ({ path, face })),
    )
    .filter(({ face }) => /font-family:\s*'Inter'/.test(face));

  it('puts Inter first in --font-sans and keeps the system stack behind it', () => {
    expect(themeFontSans().startsWith("'Inter', -apple-system,")).toBe(true);
  });

  it('declares one Inter face, in styles.css, pointing at the bundled file', () => {
    expect(interFaces).toHaveLength(1);
    const [only] = interFaces;
    expect(only?.path).toBe(STYLES_PATH);
    const url = /src:\s*url\('([^']+)'\)/.exec(only?.face ?? '');
    expect(url).not.toBeNull();
    expect(resolve(dirname(STYLES_PATH), String(url?.[1]))).toBe(FONT_PATH);
    expect(existsSync(FONT_PATH)).toBe(true);
  });

  it('keeps the artifact data uri byte-equal to the bundled file', () => {
    const encoded = INTER_FONT_DATA_URI.replace('data:font/woff2;base64,', '');
    expect(sha256({ bytes: Buffer.from(encoded, 'base64') })).toBe(
      sha256({ bytes: readFileSync(FONT_PATH) }),
    );
  });

  it('turns on only the OpenType features the bundled file carries', () => {
    const tables = woff2Tables({ font: readFileSync(FONT_PATH) });
    const available = new Set([
      ...layoutFeatures({ table: tables.get('GSUB') }),
      ...layoutFeatures({ table: tables.get('GPOS') }),
    ]);
    const requested = bodyFeatureTags();
    expect(requested).toEqual(['calt']);
    expect(requested.filter((tag) => !available.has(tag))).toEqual([]);
    expect(available.has('tnum')).toBe(true);
    expect(tables.has('fvar')).toBe(true);
    expect(styles).toMatch(/\nbody \{[^}]*font-optical-sizing: auto;/);
  });

  it('keeps tabular figures on the meta role, off running text where they widen the hyphen', () => {
    expect(styles).toMatch(/\.text-meta \{\s*font-variant-numeric: tabular-nums;\s*\}/);
    expect(bodyFeatureTags()).not.toContain('tnum');
  });
});
