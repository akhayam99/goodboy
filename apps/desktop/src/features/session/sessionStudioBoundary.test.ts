import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type CollectSourceFilesParams = {
  readonly directory: string;
};

const collectSourceFiles = ({ directory }: CollectSourceFilesParams): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles({ directory: entryPath });
    }
    if (/\.(ts|tsx)$/.test(entry.name) === false || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      return [];
    }
    return [entryPath];
  });

const SOURCE_ROOT = resolve(process.cwd(), 'src/features');
const SESSION_SURFACE_FILES = [
  ...collectSourceFiles({ directory: join(SOURCE_ROOT, 'session') }),
  ...collectSourceFiles({ directory: join(SOURCE_ROOT, 'chat') }),
  join(SOURCE_ROOT, 'integrations/components/ExternalTaskChip/index.tsx'),
];

const TOP_LEVEL_STUDIOS = ['github', 'gitlab', 'linear', 'provider', 'impact'];

const TOP_LEVEL_STUDIO_EVENT = new RegExp(
  `goodboy:open-(?:${TOP_LEVEL_STUDIOS.join('|')}|\\$\\{[^}]+\\})-studio`,
);

describe('session studio boundary', () => {
  it.each(SESSION_SURFACE_FILES)('%s does not dispatch a top-level studio event', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source, file).not.toMatch(TOP_LEVEL_STUDIO_EVENT);
  });
});
