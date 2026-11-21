// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RETIRED } from './retired/open';

const SRC = join(__dirname, '..', '..');

const sourcesOf = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'MockScene' ? [] : sourcesOf(path);
    }
    return name.endsWith('.tsx') && !name.includes('.test.') ? [path] : [];
  });

const retiredIdsIn = ({ text }: { readonly text: string }): ReadonlyArray<string> =>
  RETIRED.filter((retired) => retired.pattern.test(text)).map((retired) => retired.id);

describe('the open and close words', () => {
  it.each([
    ['Open page', 'open-page'],
    ['Close runs', 'close-runs'],
    ['Close the item', 'close-the-item'],
    ['Back to current', 'back-to-current'],
    ['Open runs', 'open-runs-lowercase'],
    ['Open decisions', 'open-decisions'],
    ['Open explanations', 'open-explanations'],
  ])('retires %s', (text, id) => {
    expect(retiredIdsIn({ text })).toEqual([id]);
  });

  it.each(['Open full page', 'Open in Runs', 'Open in Context', 'Close', 'Open pull request'])(
    'keeps %s',
    (text) => {
      expect(retiredIdsIn({ text })).toEqual([]);
    },
  );

  it('names what an icon-only dismiss button dismisses', () => {
    const bare = [
      ...sourcesOf(join(SRC, 'app')),
      ...sourcesOf(join(SRC, 'features')),
      ...sourcesOf(join(SRC, 'shared')),
    ].filter((path) => /\blabel="Dismiss"/.test(readFileSync(path, 'utf8')));

    expect(bare.map((path) => path.slice(SRC.length + 1))).toEqual([]);
  });

  it('draws no close button under a name of its own on a drawer frame', () => {
    const named = [...sourcesOf(join(SRC, 'features')), ...sourcesOf(join(SRC, 'app'))].filter(
      (path) => /<DrawerFrame[^>]*\bcloseLabel=/s.test(readFileSync(path, 'utf8')),
    );

    expect(named.map((path) => path.slice(SRC.length + 1))).toEqual([]);
  });
});
