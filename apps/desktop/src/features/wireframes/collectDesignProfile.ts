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
} as const;

const TAILWIND_CANDIDATES = [
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'packages/ui/tailwind.config.ts',
  'apps/desktop/tailwind.config.ts',
];

const TOKEN_CANDIDATES = [
  'apps/desktop/src/styles.css',
  'packages/ui/src/styles.css',
  'src/styles.css',
  'src/index.css',
  'src/app/globals.css',
  'styles/globals.css',
];

const COMPONENT_DIRECTORIES = [
  'packages/ui/src/components',
  'src/components/ui',
  'src/components',
  'app/components',
];

const LAYOUT_CANDIDATES = [
  'src/App.tsx',
  'apps/desktop/src/App.tsx',
  'src/app/layout.tsx',
  'app/layout.tsx',
  'src/app/page.tsx',
  'app/page.tsx',
];

const CSS_VARIABLE = /--([a-z0-9-]+)\s*:\s*([^;\n]{1,64});/gi;

const VARIANT_BLOCK = /variants\s*:\s*\{\s*([\s\S]{0,600}?)\n\s*\}/;

const VARIANT_KEY = /^\s{0,12}([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm;

const clamp = ({ text, max }: { readonly text: string; readonly max: number }): string =>
  text.length <= max ? text : `${text.slice(0, max)}\n... truncated`;

const readText = async ({
  read,
  rootPath,
  relPath,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
  readonly relPath: string;
}): Promise<string | null> => {
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

const collectTailwind = async ({
  read,
  rootPath,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
}): Promise<DesignProfileFileRef | null> => {
  for (const relPath of TAILWIND_CANDIDATES) {
    const text = await readText({ read, rootPath, relPath });
    if (text !== null && text.trim().length > 0) {
      return {
        path: relPath,
        excerpt: clamp({ text, max: DESIGN_PROFILE_LIMITS.maxExcerptChars }),
      };
    }
  }
  return null;
};

const collectTokens = async ({
  read,
  rootPath,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
}): Promise<ReadonlyArray<DesignProfileToken>> => {
  const tokens: DesignProfileToken[] = [];
  const seen = new Set<string>();
  for (const relPath of TOKEN_CANDIDATES) {
    if (tokens.length >= DESIGN_PROFILE_LIMITS.maxTokens) {
      break;
    }
    const text = await readText({ read, rootPath, relPath });
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
      tokens.push({ name, value, path: relPath });
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
  const names: string[] = [];
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
  list,
  read,
  rootPath,
}: {
  readonly list: CollectDesignProfileParams['list'];
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
}): Promise<ReadonlyArray<DesignProfileVariantGroup>> => {
  const groups: DesignProfileVariantGroup[] = [];
  let scanned = 0;
  for (const directory of COMPONENT_DIRECTORIES) {
    if (groups.length >= DESIGN_PROFILE_LIMITS.maxVariantGroups) {
      break;
    }
    const entries = await listEntries({ list, rootPath, relPath: directory });
    for (const entry of entries) {
      if (
        groups.length >= DESIGN_PROFILE_LIMITS.maxVariantGroups ||
        scanned >= DESIGN_PROFILE_LIMITS.maxScannedFiles
      ) {
        break;
      }
      if (entry.isDir || !entry.name.endsWith('.tsx')) {
        continue;
      }
      scanned += 1;
      const source = await readText({ read, rootPath, relPath: entry.relPath });
      if (source === null) {
        continue;
      }
      const variants = variantNamesIn({ source });
      if (variants.length === 0) {
        continue;
      }
      groups.push({
        path: entry.relPath,
        component: entry.name.replace(/\.tsx$/, ''),
        variants,
      });
    }
  }
  return groups;
};

const collectLayoutExamples = async ({
  read,
  rootPath,
}: {
  readonly read: CollectDesignProfileParams['read'];
  readonly rootPath: string;
}): Promise<ReadonlyArray<DesignProfileFileRef>> => {
  const examples: DesignProfileFileRef[] = [];
  for (const relPath of LAYOUT_CANDIDATES) {
    if (examples.length >= DESIGN_PROFILE_LIMITS.maxLayoutExamples) {
      break;
    }
    const text = await readText({ read, rootPath, relPath });
    if (text === null || text.trim().length === 0) {
      continue;
    }
    examples.push({
      path: relPath,
      excerpt: clamp({ text, max: DESIGN_PROFILE_LIMITS.maxExcerptChars }),
    });
  }
  return examples;
};

export const collectDesignProfile = async ({
  rootPath,
  commitSha,
  projectName,
  list,
  read,
}: CollectDesignProfileParams): Promise<DesignProfile> => {
  if (rootPath.length === 0) {
    return {
      themeName: GENERIC_THEME_NAME,
      commitSha,
      tailwind: null,
      tokens: [],
      variants: [],
      layoutExamples: [],
      notes: ['no mount is attached, so no design evidence was read'],
    };
  }
  const [tailwind, tokens, variants, layoutExamples] = await Promise.all([
    collectTailwind({ read, rootPath }),
    collectTokens({ read, rootPath }),
    collectVariants({ list, read, rootPath }),
    collectLayoutExamples({ read, rootPath }),
  ]);
  const notes: string[] = [];
  if (tailwind === null) {
    notes.push('no tailwind config was found at the known paths');
  }
  if (tokens.length === 0) {
    notes.push('no css custom properties were found at the known paths');
  }
  if (variants.length === 0) {
    notes.push('no component variant maps were found');
  }
  if (layoutExamples.length === 0) {
    notes.push('no layout example was found');
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
