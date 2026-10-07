// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const DESKTOP_SRC = join(REPO_ROOT, 'apps', 'desktop', 'src');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

const EDGE = /border-l-2/g;
const TONE_CLASS =
  /\b(?:border|bg|text|ring)-(?:danger|warning|info|success|primary)\b|tintClasses\(|\b(?:accent|tint)\.(?:border|borderSoft|rail)\b/;
const WINDOW_LINES = 3;

type Reason = 'strip' | 'diff-comment' | 'transcript-rail' | 'boot' | 'log' | 'row';

type Allowance = {
  readonly count: number;
  readonly reason: Reason;
};

const ALLOWED: Readonly<Record<string, Allowance>> = {
  'apps/desktop/src/features/workflows/components/OrchestratorStrip/index.tsx': {
    count: 1,
    reason: 'strip',
  },
  'apps/desktop/src/features/workflows/components/NextActionStrip/index.tsx': {
    count: 1,
    reason: 'strip',
  },
  'apps/desktop/src/features/diff/components/DiffView/CommentComposer.tsx': {
    count: 1,
    reason: 'diff-comment',
  },
  'apps/desktop/src/features/diff/components/DiffView/CommentThread.tsx': {
    count: 1,
    reason: 'diff-comment',
  },
  'apps/desktop/src/features/chat/components/TranscriptShell/index.tsx': {
    count: 2,
    reason: 'transcript-rail',
  },
  'apps/desktop/src/features/chat/components/TranscriptDisclosure.tsx': {
    count: 1,
    reason: 'transcript-rail',
  },
  'apps/desktop/src/app/components/BootSplash/NewerDatabaseScreen.tsx': {
    count: 1,
    reason: 'boot',
  },
  'apps/desktop/src/features/scripts/components/ScriptRunDrawer/ScriptRunLog.tsx': {
    count: 1,
    reason: 'log',
  },
  'apps/desktop/src/features/session/components/AgentTree/ClusterChildRow.tsx': {
    count: 1,
    reason: 'row',
  },
};

type ListParams = {
  readonly dir: string;
  readonly acc: string[];
};

const listSourceFiles = ({ dir, acc }: ListParams): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles({ dir: full, acc });
      continue;
    }
    const isSource = entry.endsWith('.ts') || entry.endsWith('.tsx');
    if (isSource && !entry.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
};

type CountParams = {
  readonly source: string;
};

const countToneEdges = ({ source }: CountParams): number => {
  const lines = source.split('\n');
  return lines.reduce((total, line, index) => {
    const edges = line.match(EDGE)?.length ?? 0;
    if (edges === 0) {
      return total;
    }
    const near = lines.slice(Math.max(0, index - WINDOW_LINES), index + WINDOW_LINES + 1);
    return TONE_CLASS.test(near.join('\n')) ? total + edges : total;
  }, 0);
};

const measure = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const file of listSourceFiles({ dir: DESKTOP_SRC, acc: [] })) {
    const path = relative(REPO_ROOT, file).split(sep).join('/');
    const count = countToneEdges({ source: readFileSync(file, 'utf8') });
    if (count > 0) {
      counts[path] = count;
    }
  }
  return counts;
};

describe('a tone is an inner line, never an outer edge', () => {
  it('counts a left border edge that carries a tone', () => {
    const source = [
      "cn('flex rounded-r-md border-l-2 p-4',",
      "  tintClasses('danger').border,",
      ')',
    ].join('\n');
    expect(countToneEdges({ source })).toBe(1);
    expect(countToneEdges({ source: "'border-l-2 border-border-soft pl-2'" })).toBe(0);
    expect(countToneEdges({ source: "'border-l-2 border-danger pl-2'" })).toBe(1);
    expect(countToneEdges({ source: "'border-l border-danger pl-2'" })).toBe(0);
  });

  it('keeps toned edges to the sites that have a reason, and the count only falls', () => {
    const counts = measure();
    const offenders = Object.entries(counts)
      .filter(([path, count]) => count > (ALLOWED[path]?.count ?? 0))
      .map(([path, count]) => `${path}: ${count} (allowed ${ALLOWED[path]?.count ?? 0})`);
    expect(
      offenders,
      `A tone on a card is one inner line: render a Notice, or a ToneBar inside the padding (DESIGN-SYSTEM.md, Notices). An outer left edge is only for a quote rail:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('shrinks the allowance as edges go away', () => {
    const counts = measure();
    const stale = Object.entries(ALLOWED)
      .filter(([path, allowance]) => (counts[path] ?? 0) < allowance.count)
      .map(
        ([path, allowance]) => `${path}: allowed ${allowance.count}, found ${counts[path] ?? 0}`,
      );
    expect(stale, `Lower or remove these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
