import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  DevToolsTimeoutError,
  failingScenes,
  measureScene,
  parseDevToolsPort,
  readDevToolsPort,
  summaryLine,
} from './validateScenesBrowser.mjs';

const withProfile = async (body) => {
  const profile = mkdtempSync(join(tmpdir(), 'validate-scenes-test-'));
  try {
    await body(profile);
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
};

const timeout = () => new DevToolsTimeoutError({ method: 'Runtime.evaluate', timeoutMs: 60_000 });

describe('readDevToolsPort', () => {
  it('reads the port from the first line of DevToolsActivePort', async () => {
    await withProfile(async (profile) => {
      writeFileSync(join(profile, 'DevToolsActivePort'), '41873\n/devtools/browser/abc\n');
      assert.equal(await readDevToolsPort({ profile }), 41873);
    });
  });

  it('waits for Chrome to write the file', async () => {
    await withProfile(async (profile) => {
      let polls = 0;
      const pause = async () => {
        polls += 1;
        if (polls === 3) {
          writeFileSync(join(profile, 'DevToolsActivePort'), '40123\n/devtools/browser/abc\n');
        }
      };
      assert.equal(await readDevToolsPort({ profile, pause }), 40123);
      assert.equal(polls, 3);
    });
  });

  it('gives up when the file never appears', async () => {
    await withProfile(async (profile) => {
      await assert.rejects(
        readDevToolsPort({ profile, timeoutMs: 300, pause: async () => {} }),
        /did not write DevToolsActivePort/,
      );
    });
  });

  it('rejects a file that holds no port', () => {
    assert.equal(parseDevToolsPort({ text: '' }), null);
    assert.equal(parseDevToolsPort({ text: 'nope\n/devtools' }), null);
    assert.equal(parseDevToolsPort({ text: '0\n' }), null);
    assert.equal(parseDevToolsPort({ text: '70000\n' }), null);
  });
});

describe('measureScene', () => {
  it('retries once and returns the second result', async () => {
    let calls = 0;
    const outcome = await measureScene({
      scene: 'activity-run',
      task: async () => {
        calls += 1;
        if (calls === 1) throw timeout();
        return 'ok';
      },
    });
    assert.equal(outcome, 'ok');
    assert.equal(calls, 2);
  });

  it('names the scene and the call when the retry times out too', async () => {
    let calls = 0;
    await assert.rejects(
      measureScene({
        scene: 'activity-run',
        task: async () => {
          calls += 1;
          throw timeout();
        },
      }),
      { message: 'scene activity-run: Runtime.evaluate timed out after 60s' },
    );
    assert.equal(calls, 2);
  });

  it('does not retry an error that is not a timeout', async () => {
    let calls = 0;
    await assert.rejects(
      measureScene({
        scene: 'inbox',
        task: async () => {
          calls += 1;
          throw new Error('Chrome DevTools connection failed');
        },
      }),
      { message: 'Chrome DevTools connection failed' },
    );
    assert.equal(calls, 1);
  });
});

describe('summaryLine', () => {
  it('says ok when nothing failed', () => {
    assert.equal(
      summaryLine({ scenes: failingScenes({ failures: [], error: null }) }),
      'scene measures: ok',
    );
  });

  it('names the scenes that failed a check', () => {
    const failures = [{ scene: 'inbox' }, { scene: 'inbox' }, { scene: 'plan-drawer-waiting' }];
    assert.equal(
      summaryLine({ scenes: failingScenes({ failures, error: null }) }),
      'scene measures: failed in inbox, plan-drawer-waiting',
    );
  });

  it('names the scene from a timeout', () => {
    const error = new Error('scene activity-run: Runtime.evaluate timed out after 60s');
    assert.equal(
      summaryLine({ scenes: failingScenes({ failures: [], error }) }),
      'scene measures: failed in activity-run',
    );
  });
});
