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

const GENERATED_DIRS = new Set(['dist', 'build', 'vendor']);

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
