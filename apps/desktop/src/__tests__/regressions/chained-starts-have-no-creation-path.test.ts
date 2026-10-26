// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_SRC, desktopSources, isTestSource } from '../helpers/sourceImports';

const CREATES_A_CHAIN = [
  /triggerMode:\s*'after_run'/,
  /(?<![.\w])chainAfterId\b(?!\s*[=!]==?)(?!\s*\?\?)/,
];

const productionSources = (): ReadonlyArray<string> =>
  desktopSources().filter(
    (path) => !isTestSource(path) && !path.startsWith('app/components/MockScene/'),
  );

describe('chained starts have no creation path', () => {
  it('no production file writes a chained run: only reads of a row an older release saved remain', () => {
    const writers = productionSources().filter((path) => {
      const text = readFileSync(join(DESKTOP_SRC, path), 'utf8');
      return CREATES_A_CHAIN.some((pattern) => pattern.test(text));
    });

    expect(writers).toEqual([]);
  });

  it('keeps reading a chained row: the engine and the labels still name the predecessor', () => {
    const readers = productionSources().filter((path) =>
      /\.chainAfterId\b/.test(readFileSync(join(DESKTOP_SRC, path), 'utf8')),
    );

    expect(readers).toEqual(
      expect.arrayContaining([
        'features/session/components/AgentTree/useRunView/index.ts',
        'features/session/sessionRunsOf.ts',
        'features/session/timeline/buildTimelineStream/runRows.ts',
        'store/slices/workflows/maybeAutoAdvanceWorkflow.ts',
      ]),
    );
  });
});
