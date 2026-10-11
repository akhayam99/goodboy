// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  nonZero,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';
import { countOldEntryPointImports } from './scanResolverImports';

const BASELINE_FILE = 'resolver-entrypoints.baseline.json';

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countOldEntryPointImports({ text })]),
    ),
  });

describe('one resolver answers what runs, so no file asks the old entry points', () => {
  it('counts every old entry point a file imports, with type and alias forms', () => {
    expect(
      countOldEntryPointImports({
        text: "import { resolveRoleRouting } from '@goodboy/core';",
      }),
    ).toBe(1);
    expect(
      countOldEntryPointImports({
        text: "import {\n  resolveTaskModel as taskModel,\n  resolveAuto,\n  type AutoContext,\n} from '@goodboy/core';",
      }),
    ).toBe(2);
    expect(
      countOldEntryPointImports({
        text: "import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';",
      }),
    ).toBe(1);
    expect(
      countOldEntryPointImports({
        text: "export { autoModelForRole, recommendedModelForRole } from './providers/auto-model';",
      }),
    ).toBe(2);
  });

  it('leaves the resolver and its siblings alone', () => {
    expect(
      countOldEntryPointImports({
        text: "import { resolveSlot, explainResolution, type Resolution } from '@goodboy/core';",
      }),
    ).toBe(0);
    expect(
      countOldEntryPointImports({ text: 'const resolveAuto = () => null;\nresolveRoleRouting();' }),
    ).toBe(0);
  });

  it('fails a fixture that imports resolveRoleRouting outside the resolver folder', () => {
    const grown = grownEntries({
      current: {
        'apps/desktop/src/features/x/fixture.ts': countOldEntryPointImports({
          text: "import { resolveRoleRouting } from '@goodboy/core';",
        }),
      },
      baseline: {},
    });

    expect(grown).toEqual(['  - apps/desktop/src/features/x/fixture.ts: 1 (baseline 0)']);
  });

  it('adds no import of an old entry point beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Ask useResolution (React) or selectResolution (store) instead of resolveRoleRouting, resolveTaskModel, resolveAuto or their wrappers (docs/providers.md, Defaults and task models). Moving a call site lowers a count: regenerate the baseline with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
