import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const SRC_ROOT = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', join('app', 'components'), join('shared', 'components')];
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  '__tests__',
  'testing',
  'MockScene',
]);

import { scanCopySource, type CopyString } from './scanCopySource';

type WalkParams = {
  readonly directory: string;
};

const walk = ({ directory }: WalkParams): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      return walk({ directory: full });
    }
    const isSource =
      /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !entry.endsWith('.d.ts');
    return isSource ? [full] : [];
  });
};

export const scanCopy = (): ReadonlyArray<CopyString> =>
  SCANNED_ROOTS.flatMap((root) => walk({ directory: join(SRC_ROOT, root) })).flatMap((path) =>
    scanCopySource({
      path: relative(SRC_ROOT, path).split(sep).join('/'),
      text: readFileSync(path, 'utf8'),
    }),
  );

type DescribeParams = {
  readonly copy: CopyString;
};

export const describeCopy = ({ copy }: DescribeParams): string =>
  `${copy.path}:${copy.line}: ${copy.text.slice(0, 100)}`;
