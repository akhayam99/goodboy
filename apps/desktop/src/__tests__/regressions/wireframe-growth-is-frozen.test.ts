// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_SRC, desktopSources, isTestSource } from '../helpers/sourceImports';

const WIREFRAME_LINE_CEILING = 7976;

const wireframeLines = (): number =>
  desktopSources()
    .filter(
      (path) =>
        path.startsWith('features/wireframes/') &&
        !isTestSource(path) &&
        !path.includes('/testing/'),
    )
    .reduce(
      (total, path) => total + readFileSync(join(DESKTOP_SRC, path), 'utf8').split('\n').length - 1,
      0,
    );

describe('wireframes are kept, not grown', () => {
  it('holds no more production lines than the ceiling, which only falls', () => {
    expect(wireframeLines()).toBeLessThanOrEqual(WIREFRAME_LINE_CEILING);
  });

  it('has a ceiling that is no slack: lower it when the folder shrinks', () => {
    expect(wireframeLines()).toBe(WIREFRAME_LINE_CEILING);
  });
});
