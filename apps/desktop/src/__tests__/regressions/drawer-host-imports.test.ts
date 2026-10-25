// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_SRC, importsOf } from '../helpers/sourceImports';
import { IS_UPDATING, readBaseline, writeBaseline, type FileCounts } from './scanControls';

const BASELINE_FILE = 'drawer-host-imports.baseline.json';
const HOST_PATH = 'app/components/DrawerHost.tsx';
const KEY = `apps/desktop/src/${HOST_PATH}`;

type TextParams = {
  readonly text: string;
};

const featureImportCount = ({ text }: TextParams): number =>
  importsOf({ path: HOST_PATH, text }).filter(({ target }) => target.startsWith('features/'))
    .length;

const measure = (): FileCounts => ({
  [KEY]: featureImportCount({ text: readFileSync(join(DESKTOP_SRC, HOST_PATH), 'utf8') }),
});

describe('the drawer host reaches features through registrations', () => {
  it('counts the imports of a feature and nothing else', () => {
    const text = [
      "import { A } from '../../features/diff/components/DiffView';",
      "import { B } from '../../store';",
      "import { C } from './PanelBoundary';",
      "import { D } from '../../features/history/historyVersionsDrawerRegistration';",
    ].join('\n');
    expect(featureImportCount({ text })).toBe(2);
  });

  it('holds the drawer host to the baseline: a new drawer is a registration', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const baseline = readBaseline({ file: BASELINE_FILE });
    const now = current[KEY] ?? 0;
    const allowed = baseline[KEY] ?? 0;
    expect(
      now,
      `DrawerHost.tsx imports ${now} feature modules, the baseline allows ${allowed}. A feature exports a drawerRegistration (store/slices/drawer/drawerRegistration.ts) and app/components/renderRegisteredDrawer.tsx calls it; the host does not import the drawer. Lower the baseline with GOODBOY_UPDATE_BASELINE=1 when the count falls.`,
    ).toBe(allowed);
  });
});
