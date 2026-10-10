import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findOffenses } from './check-rules.mjs';

const NO_BASELINE = { core: {}, guards: {} };

describe('findOffenses', () => {
  it('prints one line per new offense with its hint', () => {
    const lines = findOffenses({
      files: [
        {
          path: 'apps/desktop/src-tauri/src/a.rs',
          text: 'fn a() {\n    if x {\n    } else {\n    }\n}',
        },
      ],
      baselines: NO_BASELINE,
    });
    assert.equal(lines.length, 1);
    assert.match(
      lines[0],
      /rust-else apps\/desktop\/src-tauri\/src\/a\.rs: 1 \(baseline 0\) at line 3/,
    );
    assert.match(lines[0], /guard clause/);
  });

  it('passes a file at its baseline and fails above it', () => {
    const files = [
      {
        path: 'apps/desktop/src/features/x/Row.tsx',
        text: '<div className="mt-2">\n<div className="mb-2">',
      },
    ];
    const guards = { 'sibling-margin': { 'apps/desktop/src/features/x/Row.tsx': 2 } };
    assert.deepEqual(findOffenses({ files, baselines: { core: {}, guards } }), []);
    const lower = { 'sibling-margin': { 'apps/desktop/src/features/x/Row.tsx': 1 } };
    assert.equal(findOffenses({ files, baselines: { core: {}, guards: lower } }).length, 1);
  });

  it('reads the core ledger for an old rule on a core file', () => {
    const files = [{ path: 'apps/desktop/src/a.ts', text: 'if (a) {\n} else {\n}' }];
    const core = { 'else-branch': { 'apps/desktop/src/a.ts': 1 } };
    assert.deepEqual(findOffenses({ files, baselines: { core, guards: {} } }), []);
    assert.equal(findOffenses({ files, baselines: NO_BASELINE }).length, 1);
  });

  it('skips a file no rule scans', () => {
    const files = [
      { path: 'docs/a.md', text: '} else {' },
      { path: 'apps/desktop/src/vite-env.d.ts', text: 'const a: any = 1;' },
    ];
    assert.deepEqual(findOffenses({ files, baselines: NO_BASELINE }), []);
  });

  it('returns nothing for an empty list', () => {
    assert.deepEqual(findOffenses({ files: [], baselines: NO_BASELINE }), []);
  });
});
