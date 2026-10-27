import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { isSceneBacked, sceneBackedTests } from './scene-backed-tests.mjs';

describe('isSceneBacked', () => {
  it('reads a test that imports a scene folder, a seed or the scene clock', () => {
    assert.equal(isSceneBacked({ source: "import { x } from '../MockScene/scenes/a';" }), true);
    assert.equal(isSceneBacked({ source: "import { y } from './centralColumnSeed';" }), true);
    assert.equal(isSceneBacked({ source: "import { sceneClock } from './sceneClock';" }), true);
  });

  it('leaves out a test that touches no scene', () => {
    assert.equal(isSceneBacked({ source: "import { z } from './formatDayMonth';" }), false);
  });
});

describe('sceneBackedTests', () => {
  it('lists only the test files that are scene backed, relative to the base', () => {
    const base = mkdtempSync(join(tmpdir(), 'scene-backed-'));
    try {
      const src = join(base, 'src');
      mkdirSync(join(src, 'features'), { recursive: true });
      mkdirSync(join(src, 'node_modules', 'x'), { recursive: true });
      writeFileSync(join(src, 'features', 'a.test.ts'), "import '../MockScene/scenes/a';");
      writeFileSync(join(src, 'features', 'b.test.ts'), "import './plain';");
      writeFileSync(join(src, 'features', 'c.ts'), "import '../MockScene/scenes/a';");
      writeFileSync(join(src, 'node_modules', 'x', 'd.test.ts'), "import 'MockScene/';");

      assert.deepEqual(sceneBackedTests({ directory: src, base }), ['src/features/a.test.ts']);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('finds the scene backed tests of this repo', () => {
    assert.ok(sceneBackedTests().length > 50);
  });
});
