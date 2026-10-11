import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { SRC, namesIn, type Row } from './harness';

export const ROW_SUFFIX = '.rows.tsx';

export const ROW_FILES = readdirSync(__dirname)
  .filter((file) => file.endsWith(ROW_SUFFIX))
  .sort();

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && 'covers' in value && 'open' in value;

export const ALL_ROWS: ReadonlyArray<Row> = Object.values(
  import.meta.glob<Record<string, unknown>>('./*.rows.tsx', { eager: true }),
).flatMap((mod) => Object.values(mod).flat().filter(isRow));

export const STUDIO_KINDS = namesIn({
  source: readFileSync(join(SRC, 'store/slices/navigation/studio.ts'), 'utf8'),
  pattern: /\{ readonly kind: '(\w+)'/g,
});
