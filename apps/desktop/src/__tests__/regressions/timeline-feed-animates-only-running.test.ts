import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const FEED = join(
  __dirname,
  '..',
  '..',
  'features',
  'session',
  'components',
  'SessionWorkspace',
  'parts',
  'TimelinePane',
);
const MARKER = join(FEED, 'TimelineMarker.tsx');

const ANIMATION = /animate-|spin-border|attention-ring/;

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
      continue;
    }
    if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
};

describe('activity feed motion', () => {
  it('animates the running marker and nothing else on the rail', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(FEED)) {
      if (file === MARKER || file.endsWith('.test.tsx') || file.endsWith('.test.ts')) {
        continue;
      }
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, idx) => {
          if (ANIMATION.test(line)) {
            offenders.push(`${relative(FEED, file)}:${idx + 1} ${line.trim()}`);
          }
        });
    }
    expect(
      offenders,
      `Running is the only animated state in the feed, and it lives in TimelineMarker.tsx:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('gates the running dot on motion-safe so reduced motion keeps the dot and drops the pulse', () => {
    const source = readFileSync(MARKER, 'utf8');
    const pulses = source.split('\n').filter((line) => line.includes('animate-soft-pulse'));

    expect(pulses).toHaveLength(1);
    expect(pulses.every((line) => line.includes('motion-safe:animate-soft-pulse'))).toBe(true);
  });
});
