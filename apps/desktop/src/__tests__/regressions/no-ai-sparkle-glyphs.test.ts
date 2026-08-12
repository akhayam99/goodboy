import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const UI_SRC = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'ui', 'src');
const SKIP_SEGMENTS = new Set(['node_modules', 'dist']);
const REGISTRY = join(DESKTOP_SRC, 'shared', 'components', 'conceptIcons.ts');
const SELF = join(__dirname, 'no-ai-sparkle-glyphs.test.ts');

const BANNED = /\b(Sparkles|Sparkle|Wand2|WandSparkles)\b/;

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
};

describe('AI iconography', () => {
  it('routes every AI affordance through a named concept, never a sparkle or a wand', () => {
    const offenders: string[] = [];
    for (const root of [DESKTOP_SRC, UI_SRC]) {
      for (const file of listSourceFiles(root)) {
        if (file === REGISTRY || file === SELF) {
          continue;
        }
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, idx) => {
            if (BANNED.test(line)) {
              offenders.push(`${relative(root, file)}:${idx + 1} ${line.trim()}`);
            }
          });
      }
    }
    expect(
      offenders,
      `Sparkles and Wand2 say "AI" and nothing else. Name the concept instead (CONCEPT_ICONS.orchestrator, .enhance, .suggestion, .autorun, .agents):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
