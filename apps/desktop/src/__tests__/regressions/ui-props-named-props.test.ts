// @vitest-environment node
import { readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const UI_COMPONENTS = join(DESKTOP_SRC, '..', '..', '..', 'packages', 'ui', 'src', 'components');

const componentFiles = (): ReadonlyArray<string> =>
  readdirSync(UI_COMPONENTS).filter((entry) => entry.endsWith('.tsx'));

describe('ui component props naming', () => {
  it('names a component local props type Props, never after the component', () => {
    const offenders = componentFiles().flatMap((entry) => {
      const component = basename(entry, '.tsx');
      const pattern = new RegExp(`^type ${component}Props\\b`, 'm');
      const text = readFileSync(join(UI_COMPONENTS, entry), 'utf8');
      return pattern.test(text) ? [`${entry}: ${component}Props`] : [];
    });

    expect(offenders).toEqual([]);
  });
});
