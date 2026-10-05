import type { DiffHunkLine, FileDiffStatus } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';

export const LINE_PREFIX: Record<DiffHunkLine['kind'], string> = {
  add: '+',
  del: '−',
  context: ' ',
};

export const STATUS_LETTER: Record<FileDiffStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

export const STATUS_WORD: Record<FileDiffStatus, string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
};

export const STATUS_TONE: Record<FileDiffStatus, Tone> = {
  added: 'success',
  modified: 'warning',
  deleted: 'danger',
  renamed: 'info',
};

export type SplitPath = {
  readonly dir: string;
  readonly name: string;
};

export const splitPath = (path: string): SplitPath => {
  const slash = path.lastIndexOf('/');
  if (slash < 0) {
    return { dir: '', name: path };
  }
  return { dir: path.slice(0, slash + 1), name: path.slice(slash + 1) };
};

const GENERATED_NAMES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'Gemfile.lock',
  'composer.lock',
]);

const GENERATED_DIRS = new Set(['dist', 'build', 'vendor', '__generated__']);

const GENERATED_SUFFIXES = ['.min.js', '.min.css', '.map'];

export const isGeneratedPath = (path: string): boolean => {
  const parts = path.split('/');
  const name = parts[parts.length - 1] ?? '';
  return (
    GENERATED_NAMES.has(name) ||
    GENERATED_SUFFIXES.some((suffix) => name.endsWith(suffix)) ||
    parts.slice(0, -1).some((part) => GENERATED_DIRS.has(part))
  );
};

export type FileKind = 'source' | 'test' | 'config' | 'docs' | 'generated';

const TEST_DIRS = new Set(['test', 'tests', '__tests__', 'spec', 'specs', 'e2e']);

const TEST_NAME = /\.(test|spec)\.[^.]+$/;

const DOC_EXTENSIONS = ['.md', '.mdx', '.rst', '.txt'];

const CONFIG_EXTENSIONS = ['.json', '.yaml', '.yml', '.toml', '.ini'];

export const fileKindOf = (path: string): FileKind => {
  if (isGeneratedPath(path)) {
    return 'generated';
  }
  const parts = path.split('/');
  const name = parts[parts.length - 1] ?? '';
  const dirs = parts.slice(0, -1);
  if (TEST_NAME.test(name) || dirs.some((part) => TEST_DIRS.has(part))) {
    return 'test';
  }
  if (DOC_EXTENSIONS.some((suffix) => name.endsWith(suffix)) || dirs.includes('docs')) {
    return 'docs';
  }
  if (
    name.startsWith('.') ||
    name.includes('.config.') ||
    CONFIG_EXTENSIONS.some((suffix) => name.endsWith(suffix))
  ) {
    return 'config';
  }
  return 'source';
};
