import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Brush,
  Database,
  FileCode2,
  FlaskConical,
  Hammer,
  Package,
  Play,
  Rocket,
  SearchCheck,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import type { Tone } from '@goodboy/ui';

export type ScriptCategory =
  | 'dev'
  | 'build'
  | 'test'
  | 'lint'
  | 'typecheck'
  | 'format'
  | 'db'
  | 'generate'
  | 'install'
  | 'deploy'
  | 'clean'
  | 'docs'
  | 'other';

type ScriptCategoryDefinition = {
  readonly id: ScriptCategory;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tone: Tone;
};

type ClassifyScriptParams = {
  readonly name: string;
  readonly command: string;
};

type GroupScriptsParams<T extends ClassifyScriptParams> = {
  readonly scripts: ReadonlyArray<T>;
};

type CategoryRule = {
  readonly id: Exclude<ScriptCategory, 'other'>;
  readonly terms: ReadonlyArray<string>;
};

export const SCRIPT_CATEGORIES: ReadonlyArray<ScriptCategoryDefinition> = [
  { id: 'dev', label: 'Dev', icon: Play, tone: 'info' },
  { id: 'build', label: 'Build', icon: Hammer, tone: 'accent' },
  { id: 'test', label: 'Test', icon: FlaskConical, tone: 'success' },
  { id: 'lint', label: 'Lint', icon: SearchCheck, tone: 'warning' },
  { id: 'typecheck', label: 'Typecheck', icon: ShieldCheck, tone: 'info' },
  { id: 'format', label: 'Format', icon: Brush, tone: 'neutral' },
  { id: 'db', label: 'Database', icon: Database, tone: 'accent' },
  { id: 'generate', label: 'Generate', icon: FileCode2, tone: 'accent' },
  { id: 'install', label: 'Install', icon: Package, tone: 'neutral' },
  { id: 'deploy', label: 'Deploy', icon: Rocket, tone: 'danger' },
  { id: 'clean', label: 'Clean', icon: Trash2, tone: 'neutral' },
  { id: 'docs', label: 'Docs', icon: BookOpen, tone: 'info' },
  { id: 'other', label: 'Other', icon: Terminal, tone: 'neutral' },
];

const CATEGORY_RULES: ReadonlyArray<CategoryRule> = [
  {
    id: 'typecheck',
    terms: ['typecheck', 'type-check', 'tsc', 'types', 'check-types'],
  },
  {
    id: 'test',
    terms: ['test', 'tests', 'spec', 'vitest', 'jest', 'playwright', 'e2e', 'cypress', 'coverage'],
  },
  { id: 'lint', terms: ['lint', 'eslint', 'biome', 'stylelint', 'knip', 'audit'] },
  { id: 'format', terms: ['format', 'fmt', 'prettier'] },
  { id: 'build', terms: ['build', 'compile', 'bundle', 'dist', 'pack'] },
  { id: 'dev', terms: ['dev', 'start', 'serve', 'watch', 'preview'] },
  { id: 'db', terms: ['db', 'migrate', 'migration', 'prisma', 'seed', 'drizzle', 'knex', 'sql'] },
  { id: 'generate', terms: ['gen', 'generate', 'codegen', 'openapi', 'graphql'] },
  {
    id: 'install',
    terms: ['install', 'setup', 'bootstrap', 'prepare', 'postinstall', 'preinstall', 'env'],
  },
  { id: 'deploy', terms: ['deploy', 'release', 'publish', 'ship', 'version', 'changeset'] },
  { id: 'clean', terms: ['clean', 'clear', 'reset', 'purge', 'nuke'] },
  { id: 'docs', terms: ['docs', 'doc', 'storybook', 'typedoc'] },
];

const tokenize = ({ value }: { readonly value: string }): ReadonlySet<string> => {
  const camelSeparated = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLocaleLowerCase();
  const tokens = camelSeparated.split(/[^a-z0-9]+/).filter((token) => token !== '');
  return new Set([...tokens, tokens.join('-'), tokens.join('')]);
};

const categoryForValue = ({ value }: { readonly value: string }): ScriptCategory | null => {
  const tokens = tokenize({ value });
  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => tokens.has(term))) {
      return rule.id;
    }
  }
  return null;
};

export const classifyScript = ({ name, command }: ClassifyScriptParams): ScriptCategory =>
  categoryForValue({ value: name }) ?? categoryForValue({ value: command }) ?? 'other';

export const groupScriptsByCategory = <T extends ClassifyScriptParams>({
  scripts,
}: GroupScriptsParams<T>): ReadonlyMap<ScriptCategory, ReadonlyArray<T>> => {
  const groups = new Map<ScriptCategory, Array<T>>();
  for (const script of scripts) {
    const category = classifyScript(script);
    const bucket = groups.get(category);
    if (bucket === undefined) {
      groups.set(category, [script]);
    } else {
      bucket.push(script);
    }
  }
  return groups;
};
