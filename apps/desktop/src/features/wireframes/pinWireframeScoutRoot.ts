export const WIREFRAME_SCOUT_REPOSITORY_ROOT = '.';

export const WIREFRAME_SCOUT_ROOT_CANDIDATE_CAP = 40;

const STRUCTURAL_SEGMENTS: ReadonlySet<string> = new Set([
  'app',
  'apps',
  'lib',
  'libs',
  'package',
  'packages',
  'src',
  'workspace',
  'workspaces',
]);

const TOKEN_MIN_LENGTH = 3;

export type PinnedWireframeScoutRoot = Readonly<{
  path: string;
  reason: string;
}>;

type PinParams = Readonly<{
  candidates: ReadonlyArray<string>;
  goal: string;
  brief: string | null;
}>;

const tokensOf = ({ text }: Readonly<{ text: string }>): ReadonlySet<string> => {
  const matched = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(matched.filter((token) => token.length >= TOKEN_MIN_LENGTH));
};

const segmentsOf = ({ path }: Readonly<{ path: string }>): ReadonlyArray<string> =>
  path
    .toLowerCase()
    .split(/[/\-_.]/)
    .filter((segment) => segment.length >= TOKEN_MIN_LENGTH && !STRUCTURAL_SEGMENTS.has(segment));

type ScoredCandidate = Readonly<{
  path: string;
  score: number;
  matched: ReadonlyArray<string>;
}>;

const scoreCandidate = ({
  path,
  tokens,
}: Readonly<{ path: string; tokens: ReadonlySet<string> }>): ScoredCandidate => {
  const matched: Array<string> = [];
  for (const segment of segmentsOf({ path })) {
    if (tokens.has(segment) && !matched.includes(segment)) {
      matched.push(segment);
    }
  }
  return { path, score: matched.length, matched };
};

const isBetter = ({
  candidate,
  best,
}: Readonly<{ candidate: ScoredCandidate; best: ScoredCandidate }>): boolean => {
  if (candidate.score !== best.score) {
    return candidate.score > best.score;
  }
  if (candidate.path.length !== best.path.length) {
    return candidate.path.length < best.path.length;
  }
  return candidate.path < best.path;
};

export const pinWireframeScoutRoot = ({
  candidates,
  goal,
  brief,
}: PinParams): PinnedWireframeScoutRoot => {
  const usable = candidates.filter((candidate) => candidate.trim().length > 0);
  if (usable.length === 0) {
    return {
      path: WIREFRAME_SCOUT_REPOSITORY_ROOT,
      reason: 'this repository declares no workspaces, so the whole repository is the root',
    };
  }
  const tokens = tokensOf({ text: `${goal} ${brief ?? ''}` });
  let best: ScoredCandidate | null = null;
  for (const candidate of usable) {
    const scored = scoreCandidate({ path: candidate.trim(), tokens });
    if (best === null || isBetter({ candidate: scored, best })) {
      best = scored;
    }
  }
  if (best === null || best.score === 0) {
    return {
      path: WIREFRAME_SCOUT_REPOSITORY_ROOT,
      reason: `nothing in the goal or brief named one of the ${usable.length} workspaces, so the whole repository is the root`,
    };
  }
  return {
    path: best.path,
    reason: `"${best.matched.join('", "')}" in the goal or brief names this workspace`,
  };
};

type ListEntry = Readonly<{ name: string; isDir: boolean }>;

type CollectParams = Readonly<{
  list: (params: Readonly<{ relPath: string }>) => Promise<ReadonlyArray<ListEntry>>;
  read: (params: Readonly<{ relPath: string }>) => Promise<string | null>;
}>;

const inlineSequenceEntries = ({ text }: Readonly<{ text: string }>): ReadonlyArray<string> =>
  text
    .split(',')
    .map((entry) => entry.trim().replace(/^['"]/, '').replace(/['"]$/, '').trim())
    .filter((entry) => entry.length > 0);

const pnpmWorkspacePatterns = ({ text }: Readonly<{ text: string }>): ReadonlyArray<string> => {
  const patterns: Array<string> = [];
  let isInPackages = false;
  for (const line of text.split(/\r?\n/)) {
    const inline = line.match(/^packages\s*:\s*\[([^\]]*)\]/);
    if (inline !== null) {
      patterns.push(...inlineSequenceEntries({ text: inline[1]! }));
      isInPackages = false;
      continue;
    }
    if (/^packages\s*:/.test(line)) {
      isInPackages = true;
      continue;
    }
    if (isInPackages === false) {
      continue;
    }
    const entry = line.match(/^\s+-\s*['"]?([^'"#\s]+)/);
    if (entry !== null) {
      patterns.push(entry[1]!);
      continue;
    }
    if (line.trim().length > 0 && !line.startsWith(' ')) {
      isInPackages = false;
    }
  }
  return patterns;
};

const packageJsonPatterns = ({ text }: Readonly<{ text: string }>): ReadonlyArray<string> => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) {
      return [];
    }
    const workspaces = (parsed as Record<string, unknown>)['workspaces'];
    if (Array.isArray(workspaces)) {
      return workspaces.filter((entry): entry is string => typeof entry === 'string');
    }
    if (typeof workspaces === 'object' && workspaces !== null) {
      const packages = (workspaces as Record<string, unknown>)['packages'];
      return Array.isArray(packages)
        ? packages.filter((entry): entry is string => typeof entry === 'string')
        : [];
    }
    return [];
  } catch {
    return [];
  }
};

const expandPattern = async ({
  pattern,
  list,
}: Readonly<{
  pattern: string;
  list: CollectParams['list'];
}>): Promise<ReadonlyArray<string>> => {
  const clean = pattern.trim().replace(/^\.\//, '').replace(/\/$/, '');
  if (clean.length === 0 || clean.startsWith('!') || clean.includes('**')) {
    return [];
  }
  if (!clean.includes('*')) {
    return [clean];
  }
  if (!clean.endsWith('/*')) {
    return [];
  }
  const base = clean.slice(0, -2);
  try {
    const entries = await list({ relPath: base });
    return entries
      .filter((entry) => entry.isDir && !entry.name.startsWith('.'))
      .map((entry) => `${base}/${entry.name}`);
  } catch {
    return [];
  }
};

export const collectWireframeScoutRootCandidates = async ({
  list,
  read,
}: CollectParams): Promise<ReadonlyArray<string>> => {
  const pnpm = await read({ relPath: 'pnpm-workspace.yaml' }).catch(() => null);
  const patterns =
    pnpm === null || pnpm.trim().length === 0
      ? packageJsonPatterns({
          text: (await read({ relPath: 'package.json' }).catch(() => null)) ?? '',
        })
      : pnpmWorkspacePatterns({ text: pnpm });
  const roots: Array<string> = [];
  for (const pattern of patterns) {
    for (const expanded of await expandPattern({ pattern, list })) {
      if (!roots.includes(expanded)) {
        roots.push(expanded);
      }
      if (roots.length === WIREFRAME_SCOUT_ROOT_CANDIDATE_CAP) {
        return roots;
      }
    }
  }
  return roots;
};
