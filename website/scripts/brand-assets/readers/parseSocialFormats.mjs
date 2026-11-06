import { requireMatch } from './requireMatch.mjs';

export const parseSocialFormats = (brandSource) => {
  const section = requireMatch({
    source: brandSource,
    pattern: /## Social formats\s+([\s\S]*?)(?=\n##\s|$)/,
    description: 'the Social formats section in docs/brand.md',
  })[1];
  const rows = section
    .split('\n')
    .filter((line) => /^\|/.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter(
      ([surface, size]) => surface !== 'Surface' && !/^-+$/.test(surface) && size !== undefined,
    )
    .map(([surface, size, keepClear]) => {
      const dimensions = requireMatch({
        source: size,
        pattern: /(\d+)x(\d+)/,
        description: `dimensions for ${surface} in docs/brand.md`,
      });
      const scale = /\b2x\b/i.test(size) ? 2 : 1;
      return {
        surface,
        width: Number(dimensions[1]),
        height: Number(dimensions[2]),
        scale,
        keepClear,
      };
    });
  if (rows.length === 5) {
    return rows;
  }
  throw new Error(`Expected five Social formats rows, found ${rows.length}`);
};
