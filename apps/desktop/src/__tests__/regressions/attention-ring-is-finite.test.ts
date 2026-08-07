import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const STYLES_CSS = join(__dirname, '..', '..', 'styles.css');

type NoPreferenceRange = { readonly start: number; readonly end: number };

const findNoPreferenceRanges = ({ lines }: { lines: ReadonlyArray<string> }) => {
  const ranges: NoPreferenceRange[] = [];
  let depth = 0;
  let activeStart: number | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const opensNoPreference =
      depth === 0 &&
      line.includes('@media') &&
      line.includes('prefers-reduced-motion: no-preference');
    if (opensNoPreference) {
      activeStart = index;
    }
    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;
    depth += opens - closes;
    if (activeStart !== null && depth === 0) {
      ranges.push({ start: activeStart, end: index });
      activeStart = null;
    }
  }
  return ranges;
};

const findDeclarationLine = ({
  lines,
  animationName,
}: {
  lines: ReadonlyArray<string>;
  animationName: string;
}) => lines.findIndex((line) => line.includes('animation:') && line.includes(animationName));

const isInsideAnyRange = ({
  lineIndex,
  ranges,
}: {
  lineIndex: number;
  ranges: ReadonlyArray<NoPreferenceRange>;
}) => ranges.some((range) => lineIndex >= range.start && lineIndex <= range.end);

describe('attention-ring animation', () => {
  it('runs a finite number of cycles, never infinite', () => {
    const source = readFileSync(STYLES_CSS, 'utf8');
    const rule = source
      .split('\n')
      .find((line) => line.includes('animation:') && line.includes('attention-ring'));

    expect(rule, 'expected a .attention-ring animation declaration in styles.css').toBeDefined();
    expect(
      rule?.includes('infinite'),
      `.attention-ring must not loop forever, an update waiting for the user does not stay in motion: ${rule?.trim()}`,
    ).toBe(false);
  });
});

describe('motion-gated animation declarations', () => {
  const source = readFileSync(STYLES_CSS, 'utf8');
  const lines = source.split('\n');
  const ranges = findNoPreferenceRanges({ lines });

  it.each(['spin-border', 'border-pulse', 'attention-ring'])(
    '%s is declared only inside a prefers-reduced-motion: no-preference block',
    (animationName) => {
      const lineIndex = findDeclarationLine({ lines, animationName });
      expect(
        lineIndex,
        `expected an "animation:" declaration referencing ${animationName} in styles.css`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        isInsideAnyRange({ lineIndex, ranges }),
        `${animationName} must be wrapped in @media (prefers-reduced-motion: no-preference), found unwrapped at line ${lineIndex + 1}: ${lines[lineIndex]?.trim()}`,
      ).toBe(true);
    },
  );
});
