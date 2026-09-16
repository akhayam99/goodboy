import { GENERIC_THEME_NAME } from '@goodboy/core';

export type DesignProfileFileRef = Readonly<{
  path: string;
  excerpt: string;
}>;

export type DesignProfileToken = Readonly<{
  name: string;
  value: string;
  path: string;
}>;

export type DesignProfileVariantGroup = Readonly<{
  path: string;
  component: string;
  variants: ReadonlyArray<string>;
}>;

export type DesignProfile = Readonly<{
  themeName: string;
  commitSha: string | null;
  tailwind: DesignProfileFileRef | null;
  tokens: ReadonlyArray<DesignProfileToken>;
  variants: ReadonlyArray<DesignProfileVariantGroup>;
  layoutExamples: ReadonlyArray<DesignProfileFileRef>;
  notes: ReadonlyArray<string>;
}>;

export type DesignEvidence =
  Readonly<{ source: 'none' }> | Readonly<{ source: 'mount'; profile: DesignProfile }>;

export type DesignProfileEntry = Readonly<{
  name: string;
  relPath: string;
  isDir: boolean;
}>;

export type DesignProfileReadResult =
  | Readonly<{ type: 'text'; text: string; truncated: boolean }>
  | Readonly<{ type: 'dataUrl'; url: string }>;

export type CollectDesignProfileParams = Readonly<{
  rootPath: string;
  commitSha: string | null;
  projectName: string | null;
  list: (params: {
    readonly sessionDir: string;
    readonly relPath: string;
  }) => Promise<ReadonlyArray<DesignProfileEntry>>;
  read: (params: {
    readonly sessionDir: string;
    readonly relPath: string;
  }) => Promise<DesignProfileReadResult>;
}>;

export const DESIGN_PROFILE_LIMITS = {
  maxExcerptChars: 1200,
  maxTokens: 40,
  maxVariantGroups: 8,
  maxVariantsPerGroup: 10,
  maxLayoutExamples: 3,
  maxScannedFiles: 40,
  maxDirectoryDepth: 6,
  maxWalkedDirectories: 240,
} as const;

const NO_MOUNT_NOTE = 'no mount is attached, so no design evidence was read';

const READ_SHARE = {
  tailwind: 3,
  tokens: 12,
  variants: 20,
  layouts: 5,
} as const;

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  'target',
  '.git',
  '.turbo',
  'vendor',
]);

const COMPONENT_DIRECTORY_NAMES = new Set(['components', 'ui', 'design-system', 'ds']);

const ROUTE_DIRECTORY_NAMES = new Set(['app', 'pages']);

const LAYOUT_FILE_NAMES = new Set(['App.tsx', 'layout.tsx', 'page.tsx', '_app.tsx']);

const TOKEN_FILE_NAMES = ['styles', 'globals', 'index', 'theme', 'tokens', 'variables'];

const TAILWIND_CONFIG_NAME = /^tailwind\.config\.(?:ts|js|cjs|mjs)$/;

const CSS_VARIABLE = /--([a-z0-9-]+)\s*:\s*([^;\n]{1,64});/gi;

const VARIANT_BLOCK = /variants\s*:\s*\{\s*([\s\S]{0,600}?)\n\s*\}/;

const VARIANT_KEY = /^\s{0,12}([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm;

type ReadBudget = { remaining: number };

type DiscoveredFile = Readonly<{
  path: string;
  name: string;
  depth: number;
}>;

type Discovery = Readonly<{
  tailwind: ReadonlyArray<DiscoveredFile>;
  styles: ReadonlyArray<DiscoveredFile>;
  components: ReadonlyArray<DiscoveredFile>;
  layouts: ReadonlyArray<DiscoveredFile>;
  isBounded: boolean;
}>;

const clamp = ({ text, max }: { readonly text: string; readonly max: number }): string =>
  text.length <= max ? text : `${text.slice(0, max)}\n... truncated`;

const readText = async ({
  read,
  rootPath,
  relPath,
  budget,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
  readonly relPath: string;
  readonly budget: ReadBudget;
}): Promise<string | null> => {
  if (budget.remaining <= 0) {
    return null;
  }
  budget.remaining -= 1;
  try {
    const content = await read({ sessionDir: rootPath, relPath });
    return content.type === 'text' ? content.text : null;
  } catch {
    return null;
  }
};

const listEntries = async ({
  list,
  rootPath,
  relPath,
}: {
  readonly list: CollectDesignProfileParams['list'];
  readonly rootPath: string;
  readonly relPath: string;
}): Promise<ReadonlyArray<DesignProfileEntry>> => {
  try {
    return await list({ sessionDir: rootPath, relPath });
  } catch {
    return [];
  }
};

const stylePriority = ({ name }: { readonly name: string }): number => {
  const base = name.slice(0, name.length - '.css'.length).toLowerCase();
  const index = TOKEN_FILE_NAMES.indexOf(base);
  return index === -1 ? TOKEN_FILE_NAMES.length : index;
};

const byStylePreference = (left: DiscoveredFile, right: DiscoveredFile): number => {
  const priority = stylePriority({ name: left.name }) - stylePriority({ name: right.name });
  if (priority !== 0) {
    return priority;
  }
  if (left.depth !== right.depth) {
    return left.depth - right.depth;
  }
  return left.path.localeCompare(right.path);
};

const discover = async ({
  list,
  rootPath,
}: {
  readonly list: CollectDesignProfileParams['list'];
  readonly rootPath: string;
}): Promise<Discovery> => {
  const tailwind: Array<DiscoveredFile> = [];
  const styles: Array<DiscoveredFile> = [];
  const components: Array<DiscoveredFile> = [];
  const layouts: Array<DiscoveredFile> = [];
  const queue: Array<{
    readonly relPath: string;
    readonly depth: number;
    readonly isComponentTree: boolean;
    readonly isRouteTree: boolean;
  }> = [{ relPath: '', depth: 0, isComponentTree: false, isRouteTree: false }];
  let walked = 0;
  let isBounded = false;
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    if (walked >= DESIGN_PROFILE_LIMITS.maxWalkedDirectories) {
      isBounded = true;
      break;
    }
    walked += 1;
    const entries = await listEntries({ list, rootPath, relPath: current.relPath });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      if (entry.isDir) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        if (current.depth + 1 > DESIGN_PROFILE_LIMITS.maxDirectoryDepth) {
          isBounded = true;
          continue;
        }
        queue.push({
          relPath: entry.relPath,
          depth: current.depth + 1,
          isComponentTree: current.isComponentTree || COMPONENT_DIRECTORY_NAMES.has(entry.name),
          isRouteTree: ROUTE_DIRECTORY_NAMES.has(entry.name),
        });
        continue;
      }
      const file: DiscoveredFile = {
        path: entry.relPath,
        name: entry.name,
        depth: current.depth,
      };
      if (TAILWIND_CONFIG_NAME.test(entry.name)) {
        tailwind.push(file);
      }
      if (entry.name.endsWith('.css')) {
        styles.push(file);
      }
      if (current.isComponentTree && entry.name.endsWith('.tsx')) {
        components.push(file);
      }
      if (
        LAYOUT_FILE_NAMES.has(entry.name) ||
        (current.isRouteTree && entry.name.endsWith('.tsx'))
      ) {
        layouts.push(file);
      }
    }
  }
  return {
    tailwind: tailwind.slice(0, READ_SHARE.tailwind),
    styles: [...styles].sort(byStylePreference).slice(0, READ_SHARE.tokens),
    components: components.slice(0, READ_SHARE.variants),
    layouts: layouts.slice(0, READ_SHARE.layouts),
    isBounded,
  };
};

const collectTailwind = async ({
  read,
  rootPath,
  candidates,
  budget,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
  readonly candidates: ReadonlyArray<DiscoveredFile>;
  readonly budget: ReadBudget;
}): Promise<DesignProfileFileRef | null> => {
  for (const candidate of candidates) {
    const text = await readText({ read, rootPath, relPath: candidate.path, budget });
    if (text !== null && text.trim().length > 0) {
      return {
        path: candidate.path,
        excerpt: clamp({ text, max: DESIGN_PROFILE_LIMITS.maxExcerptChars }),
      };
    }
  }
  return null;
};

const collectTokens = async ({
  read,
  rootPath,
  candidates,
  budget,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
  readonly candidates: ReadonlyArray<DiscoveredFile>;
  readonly budget: ReadBudget;
}): Promise<ReadonlyArray<DesignProfileToken>> => {
  const tokens: Array<DesignProfileToken> = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (tokens.length >= DESIGN_PROFILE_LIMITS.maxTokens) {
      break;
    }
    const text = await readText({ read, rootPath, relPath: candidate.path, budget });
    if (text === null) {
      continue;
    }
    CSS_VARIABLE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CSS_VARIABLE.exec(text)) !== null) {
      const name = match[1] ?? '';
      const value = (match[2] ?? '').trim();
      if (name.length === 0 || seen.has(name)) {
        continue;
      }
      seen.add(name);
      tokens.push({ name, value, path: candidate.path });
      if (tokens.length >= DESIGN_PROFILE_LIMITS.maxTokens) {
        break;
      }
    }
  }
  return tokens;
};

const variantNamesIn = ({ source }: { readonly source: string }): ReadonlyArray<string> => {
  const block = VARIANT_BLOCK.exec(source);
  if (block === null) {
    return [];
  }
  const body = block[1] ?? '';
  const names: Array<string> = [];
  VARIANT_KEY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VARIANT_KEY.exec(body)) !== null) {
    const name = match[1] ?? '';
    if (name.length > 0 && !names.includes(name)) {
      names.push(name);
    }
    if (names.length >= DESIGN_PROFILE_LIMITS.maxVariantsPerGroup) {
      break;
    }
  }
  return names;
};

const collectVariants = async ({
  read,
  rootPath,
  candidates,
  budget,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
  readonly candidates: ReadonlyArray<DiscoveredFile>;
  readonly budget: ReadBudget;
}): Promise<ReadonlyArray<DesignProfileVariantGroup>> => {
  const groups: Array<DesignProfileVariantGroup> = [];
  for (const candidate of candidates) {
    if (groups.length >= DESIGN_PROFILE_LIMITS.maxVariantGroups) {
      break;
    }
    const source = await readText({ read, rootPath, relPath: candidate.path, budget });
    if (source === null) {
      continue;
    }
    const variants = variantNamesIn({ source });
    if (variants.length === 0) {
      continue;
    }
    groups.push({
      path: candidate.path,
      component: candidate.name.replace(/\.tsx$/, ''),
      variants,
    });
  }
  return groups;
};

const collectLayoutExamples = async ({
  read,
  rootPath,
  candidates,
  budget,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
  readonly candidates: ReadonlyArray<DiscoveredFile>;
  readonly budget: ReadBudget;
}): Promise<ReadonlyArray<DesignProfileFileRef>> => {
  const examples: Array<DesignProfileFileRef> = [];
  for (const candidate of candidates) {
    if (examples.length >= DESIGN_PROFILE_LIMITS.maxLayoutExamples) {
      break;
    }
    const text = await readText({ read, rootPath, relPath: candidate.path, budget });
    if (text === null || text.trim().length === 0) {
      continue;
    }
    examples.push({
      path: candidate.path,
      excerpt: clamp({ text, max: DESIGN_PROFILE_LIMITS.maxExcerptChars }),
    });
  }
  return examples;
};

type UnwalkedProfileParams = Readonly<{
  commitSha: string | null;
  notes: ReadonlyArray<string>;
}>;

export const unwalkedDesignProfile = ({
  commitSha,
  notes,
}: UnwalkedProfileParams): DesignProfile => ({
  themeName: GENERIC_THEME_NAME,
  commitSha,
  tailwind: null,
  tokens: [],
  variants: [],
  layoutExamples: [],
  notes,
});

export const collectDesignProfile = async ({
  rootPath,
  commitSha,
  projectName,
  list,
  read,
}: CollectDesignProfileParams): Promise<DesignProfile> => {
  if (rootPath.length === 0) {
    return unwalkedDesignProfile({ commitSha, notes: [NO_MOUNT_NOTE] });
  }
  const budget: ReadBudget = { remaining: DESIGN_PROFILE_LIMITS.maxScannedFiles };
  const discovery = await discover({ list, rootPath });
  const tailwind = await collectTailwind({
    read,
    rootPath,
    candidates: discovery.tailwind,
    budget,
  });
  const tokens = await collectTokens({ read, rootPath, candidates: discovery.styles, budget });
  const variants = await collectVariants({
    read,
    rootPath,
    candidates: discovery.components,
    budget,
  });
  const layoutExamples = await collectLayoutExamples({
    read,
    rootPath,
    candidates: discovery.layouts,
    budget,
  });
  const notes: Array<string> = [];
  if (tailwind === null) {
    notes.push('the walk found no tailwind config in this repository');
  }
  if (tokens.length === 0) {
    notes.push('the walk found no css custom properties in this repository');
  }
  if (variants.length === 0) {
    notes.push('the walk found no component variant map in this repository');
  }
  if (layoutExamples.length === 0) {
    notes.push('the walk found no layout example in this repository');
  }
  if (discovery.isBounded) {
    notes.push(
      `the walk stopped at ${DESIGN_PROFILE_LIMITS.maxDirectoryDepth} folders deep, so deeper folders were not read`,
    );
  }
  if (commitSha === null) {
    notes.push('the mount head commit was not resolved, so the refs are not pinned');
  }
  const hasEvidence =
    tailwind !== null || tokens.length > 0 || variants.length > 0 || layoutExamples.length > 0;
  const named = projectName === null || projectName.trim().length === 0 ? null : projectName.trim();
  return {
    themeName: hasEvidence && named !== null ? named : GENERIC_THEME_NAME,
    commitSha,
    tailwind,
    tokens,
    variants,
    layoutExamples,
    notes,
  };
};

export const hasDesignEvidence = ({ profile }: { readonly profile: DesignProfile }): boolean =>
  profile.tailwind !== null ||
  profile.tokens.length > 0 ||
  profile.variants.length > 0 ||
  profile.layoutExamples.length > 0;
