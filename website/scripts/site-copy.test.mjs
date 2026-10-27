import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  baselineOf,
  growthLines,
  locationsOf,
  measureSiteCopy,
  retiredPatternsFrom,
  staleLines,
} from './lib/siteCopy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(HERE, '..', 'src');
const BASELINE_PATH = join(HERE, 'site-copy.baseline.json');
const RETIRED_PATH = join(
  HERE,
  '..',
  '..',
  'apps',
  'desktop',
  'src',
  '__tests__',
  'regressions',
  'retiredNames.ts',
);

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const withSite = ({ files, run }) => {
  const root = mkdtempSync(join(tmpdir(), 'site-copy-'));
  try {
    Object.entries(files).forEach(([name, body]) => {
      const path = join(root, 'src', name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, body);
    });
    return run({ srcRoot: join(root, 'src') });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const RETIRED_SOURCE = `
export const RETIRED_NAMES = [
  { id: 'open-a-folder', pattern: /\\bOpen a folder\\b/, use: 'x' },
  {
    id: 'inbox-door',
    pattern:
      /(?<![-\\w])Inbox\\b(?!-)/i,
    use: 'y',
  },
];
`;

describe('retiredPatternsFrom', () => {
  it('reads one pattern per retired name, on one line or on two', () => {
    const patterns = retiredPatternsFrom({ source: RETIRED_SOURCE });
    assert.equal(patterns.length, 2);
    assert.equal(patterns[0].test('Open a folder'), true);
    assert.equal(patterns[1].test('your inbox'), true);
  });

  it('fails loudly when the list changes shape', () => {
    assert.throws(() => retiredPatternsFrom({ source: "{ id: 'a', pattern: buildIt() }" }));
  });

  it('reads every name the app retired', () => {
    const patterns = retiredPatternsFrom({ source: readFileSync(RETIRED_PATH, 'utf8') });
    assert.ok(patterns.length > 50);
  });
});

describe('measureSiteCopy', () => {
  const patterns = retiredPatternsFrom({ source: RETIRED_SOURCE });

  it('counts a retired name in JSX text, a prop and a template', () => {
    const measured = withSite({
      files: {
        'sections/Step.tsx': `export const Step = () => (
          <section aria-label="Open a folder">
            <p>Open a folder to begin</p>
            <p>{\`Open a folder \${1}\`}</p>
          </section>
        );`,
      },
      run: ({ srcRoot }) => measureSiteCopy({ srcRoot, patterns }),
    });
    assert.equal(measured['website/src/sections/Step.tsx']['retired-name'], 3);
  });

  it('counts an em dash and an en dash in copy', () => {
    const measured = withSite({
      files: {
        'sections/Line.tsx': `export const Line = () => <p>One ${EM} two ${EN} three</p>;`,
      },
      run: ({ srcRoot }) => measureSiteCopy({ srcRoot, patterns }),
    });
    assert.equal(measured['website/src/sections/Line.tsx'].dash, 2);
  });

  it('leaves class names, ids, links, imports and type literals alone', () => {
    const measured = withSite({
      files: {
        'sections/Quiet.tsx': `import { Inbox } from './Inbox';
          type Key = 'inbox' | 'board';
          export const Quiet = ({ kind }: { kind: Key }) => (
            <a className="Inbox Inbox" id="Inbox" href="/Inbox" data-kind={kind}>fine</a>
          );`,
      },
      run: ({ srcRoot }) => measureSiteCopy({ srcRoot, patterns }),
    });
    assert.deepEqual(measured['website/src/sections/Quiet.tsx'], { 'retired-name': 0, dash: 0 });
  });

  it('reads the copy keys of a data file and not its ids', () => {
    const measured = withSite({
      files: {
        'pages/cards.json': JSON.stringify({
          clusters: [{ id: 'inbox', mocks: ['inbox'], items: [{ title: 'Inbox', text: 'ok' }] }],
        }),
      },
      run: ({ srcRoot }) => measureSiteCopy({ srcRoot, patterns }),
    });
    assert.equal(measured['website/src/pages/cards.json']['retired-name'], 1);
  });

  it('names the line of each hit', () => {
    const lines = withSite({
      files: { 'sections/Where.tsx': `export const Where = () => (\n  <p>Open a folder</p>\n);` },
      run: ({ srcRoot }) => locationsOf({ srcRoot, patterns, id: 'retired-name' }),
    });
    assert.deepEqual(lines, ['website/src/sections/Where.tsx:2: Open a folder']);
  });
});

describe('growthLines and staleLines', () => {
  const measured = { 'website/src/a.tsx': { 'retired-name': 2, dash: 0 } };

  it('fails a file whose count grows past the baseline', () => {
    const lines = growthLines({
      measured,
      baseline: { 'retired-name': { 'website/src/a.tsx': 1 } },
    });
    assert.equal(lines.length, 1);
  });

  it('fails a new file with any hit', () => {
    assert.equal(growthLines({ measured, baseline: {} }).length, 1);
  });

  it('lets a count fall or stay', () => {
    assert.deepEqual(
      growthLines({ measured, baseline: { 'retired-name': { 'website/src/a.tsx': 2 } } }),
      [],
    );
    assert.deepEqual(
      growthLines({ measured, baseline: { 'retired-name': { 'website/src/a.tsx': 5 } } }),
      [],
    );
  });

  it('reports a baseline above the measured count', () => {
    assert.equal(
      staleLines({ measured, baseline: { 'retired-name': { 'website/src/a.tsx': 5 } } }).length,
      1,
    );
  });

  it('writes only the rules and files above zero', () => {
    assert.deepEqual(baselineOf({ measured }), { 'retired-name': { 'website/src/a.tsx': 2 } });
  });
});

describe('the site copy', () => {
  const patterns = retiredPatternsFrom({ source: readFileSync(RETIRED_PATH, 'utf8') });
  const measured = measureSiteCopy({ srcRoot: SRC_ROOT, patterns });
  const isUpdating = process.env.GOODBOY_UPDATE_BASELINE === '1';
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

  it('writes the baseline when asked', (context) => {
    if (!isUpdating) {
      context.skip('set GOODBOY_UPDATE_BASELINE=1 to regenerate');
      return;
    }
    assert.deepEqual(growthLines({ measured, baseline }), [], 'a baseline never grows');
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baselineOf({ measured }), null, 2)}\n`);
  });

  it('names nothing the app retired and has no em or en dash, per file against the baseline', () => {
    const lines = growthLines({ measured, baseline });
    if (lines.length === 0) {
      return;
    }
    const where = ['retired-name', 'dash'].flatMap((id) =>
      locationsOf({ srcRoot: SRC_ROOT, patterns, id }).map((line) => `  ${id} ${line}`),
    );
    assert.fail(
      `site copy grew past website/scripts/site-copy.baseline.json:\n${lines.join('\n')}\n${where.join('\n')}`,
    );
  });

  it('keeps no baseline row above the measured count when asked to close', (context) => {
    if (process.env.RATCHET_CLOSE !== '1') {
      context.skip('set RATCHET_CLOSE=1 to close the ratchet');
      return;
    }
    assert.deepEqual(staleLines({ measured, baseline }), []);
  });
});
