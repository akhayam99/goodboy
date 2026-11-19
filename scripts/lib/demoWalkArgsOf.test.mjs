import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { DEMO_WALK_USAGE, demoWalkArgsOf } from './demoWalkArgsOf.mjs';

const BASE = 'http://localhost:5230';

describe('demoWalkArgsOf', () => {
  it('walks every step in a dark 1440 by 900 window by default', () => {
    assert.deepEqual(demoWalkArgsOf({ argv: ['--out-dir', 'shots'], fallbackBase: BASE }), {
      outDir: resolve('shots'),
      width: 1440,
      height: 900,
      theme: 'dark',
      only: null,
      stopAfter: null,
      clip: null,
      base: BASE,
    });
  });

  it('reads --clip as the box each step picture is cut to', () => {
    const args = demoWalkArgsOf({
      argv: ['--out-dir', 'shots', '--clip', '8,64,1420,824'],
      fallbackBase: BASE,
    });
    assert.deepEqual(args.clip, { x: 8, y: 64, width: 1420, height: 824 });
  });

  it('refuses a clip without four whole numbers or with an empty side', () => {
    for (const clip of ['8,64,1420', '8,64,1420,8.5', '8,-1,1420,824', '8,64,0,824']) {
      assert.throws(
        () => demoWalkArgsOf({ argv: ['--out-dir', 'shots', '--clip', clip], fallbackBase: BASE }),
        { message: DEMO_WALK_USAGE },
      );
    }
  });

  it('stops after the step named by --stop-after', () => {
    const args = demoWalkArgsOf({
      argv: ['--out-dir', 'shots', '--stop-after', 'fix-push', '--only', 'fix-push'],
      fallbackBase: BASE,
    });
    assert.equal(args.stopAfter, 'fix-push');
    assert.deepEqual([...args.only], ['fix-push']);
  });

  it('takes the window, the theme and the base from the flags', () => {
    const args = demoWalkArgsOf({
      argv: [
        '--out-dir',
        'shots',
        '--window',
        '1000x628',
        '--theme',
        'light',
        '--base',
        'http://localhost:5252',
      ],
      fallbackBase: BASE,
    });
    assert.deepEqual(
      { width: args.width, height: args.height, theme: args.theme, base: args.base },
      { width: 1000, height: 628, theme: 'light', base: 'http://localhost:5252' },
    );
  });

  it('refuses a missing out dir, a flag without a value and an unknown theme', () => {
    for (const argv of [[], ['--out-dir'], ['--out-dir', 'shots', '--theme', 'blue']]) {
      assert.throws(() => demoWalkArgsOf({ argv, fallbackBase: BASE }), {
        message: DEMO_WALK_USAGE,
      });
    }
  });
});
