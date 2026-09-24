import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SOURCE_ROOTS = [
  join(REPO_ROOT, 'apps', 'desktop', 'src'),
  join(REPO_ROOT, 'packages', 'ui', 'src'),
];
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);
const TINT_OWNER = 'packages/ui/src/tint.ts';

const DIRECT_FILL = /tintClasses\(\s*['"](?:danger|warning)['"]\s*\)\.(?:bg|bgSoft)\b/g;
const TINT_DECLARATION = /const\s+(\w+)\s*=\s*tintClasses\(\s*['"](?:danger|warning)['"]\s*\)/g;
const RAW_FILL = /(?<![\w:/-])bg-(?:danger|warning)\/\d+/g;

type Reason = 'chip' | 'control' | 'diff' | 'debt';

type Allowance = {
  readonly count: number;
  readonly reason: Reason;
};

const ALLOWED: Readonly<Record<string, Allowance>> = {
  'apps/desktop/src/features/settings/components/GuideStudio/parts/TipsSection.tsx': {
    count: 1,
    reason: 'chip',
  },
  'apps/desktop/src/features/context/components/ContextPanel/strips/GitlabMrStrip.tsx': {
    count: 1,
    reason: 'chip',
  },
  'apps/desktop/src/features/chat/components/PhaseTransitionCard/index.tsx': {
    count: 1,
    reason: 'chip',
  },
  'apps/desktop/src/features/wireframes/components/WireframeDivergenceChip/index.tsx': {
    count: 1,
    reason: 'chip',
  },
  'apps/desktop/src/features/session/components/SummarizerBadge/index.tsx': {
    count: 1,
    reason: 'chip',
  },
  'apps/desktop/src/features/session/components/AgentTree/ScoutSubtree.tsx': {
    count: 1,
    reason: 'chip',
  },
  'apps/desktop/src/features/session/components/AgentTree/WorkflowRunStatus.tsx': {
    count: 5,
    reason: 'chip',
  },
  'apps/desktop/src/features/session/components/AgentTree/ClusterChildRow.tsx': {
    count: 1,
    reason: 'chip',
  },
  'apps/desktop/src/features/chat/components/ChatInput/index.tsx': {
    count: 1,
    reason: 'control',
  },
  'apps/desktop/src/features/workflows/components/WorkflowNextStepCta/index.tsx': {
    count: 1,
    reason: 'control',
  },
  'apps/desktop/src/shared/components/RoutingPicker/index.tsx': {
    count: 1,
    reason: 'control',
  },
  'apps/desktop/src/features/permissions/components/DiffViewerDialog/FileDiffCard.tsx': {
    count: 1,
    reason: 'diff',
  },
  'apps/desktop/src/features/permissions/components/DiffViewerDialog/DiffPairCells.tsx': {
    count: 1,
    reason: 'diff',
  },
  'apps/desktop/src/features/review/components/ReviewPane/WriteReview/ReviewPairCells.tsx': {
    count: 1,
    reason: 'diff',
  },
  'apps/desktop/src/features/review/components/ReviewPane/WriteReview/ReviewFileDiff.tsx': {
    count: 1,
    reason: 'diff',
  },
  'apps/desktop/src/features/permissions/components/DiffViewerDialog/comments/CommentItem.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/session/components/SessionWorkspace/parts/TimelinePane/TimelineStreamRow.tsx':
    {
      count: 1,
      reason: 'debt',
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

type EscapeParams = {
  readonly text: string;
};

const escapeRegExp = ({ text }: EscapeParams): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countToneFills = ({ source }: CountParams): number => {
  const direct = source.match(DIRECT_FILL)?.length ?? 0;
  const raw = source.match(RAW_FILL)?.length ?? 0;
  const aliased = [...source.matchAll(TINT_DECLARATION)].reduce((total, match) => {
    const name = escapeRegExp({ text: match[1] ?? '' });
    const uses = source.match(new RegExp(`\\b${name}\\.(?:bg|bgSoft)\\b`, 'g'));
    return total + (uses?.length ?? 0);
  }, 0);
  return direct + raw + aliased;
};

const measure = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const root of SOURCE_ROOTS) {
    for (const file of listSourceFiles({ dir: root, acc: [] })) {
      const path = relative(REPO_ROOT, file).split(sep).join('/');
      if (path === TINT_OWNER) {
        continue;
      }
      const count = countToneFills({ source: readFileSync(file, 'utf8') });
      if (count > 0) {
        counts[path] = count;
      }
    }
  }
  return counts;
};

describe('tone is a rail, not a fill', () => {
  it('counts the direct, raw and aliased danger and warning fills', () => {
    const source = [
      "const dangerTint = tintClasses('danger');",
      "cn(dangerTint.bg, tintClasses('warning').bgSoft, 'bg-danger/10', 'hover:bg-warning/10');",
      'cn(dangerTint.text, dangerTint.dot);',
    ].join('\n');
    expect(countToneFills({ source })).toBe(3);
  });

  it('keeps danger and warning fills to chips, controls and diff cells', () => {
    const counts = measure();
    const offenders = Object.entries(counts)
      .filter(([path, count]) => count > (ALLOWED[path]?.count ?? 0))
      .map(([path, count]) => `${path}: ${count}`);
    expect(
      offenders,
      `A danger or warning message says its tone with a rail and an icon, never a tinted surface. Render it as a Notice from @goodboy/ui:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('shrinks the allowlist as fills go away', () => {
    const counts = measure();
    const stale = Object.entries(ALLOWED)
      .filter(([path, allowance]) => (counts[path] ?? 0) < allowance.count)
      .map(
        ([path, allowance]) => `${path}: allowed ${allowance.count}, found ${counts[path] ?? 0}`,
      );
    expect(stale, `Lower or remove these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
