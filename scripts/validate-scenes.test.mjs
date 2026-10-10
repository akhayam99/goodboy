import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import {
  DevToolsTimeoutError,
  failingScenes,
  failureLines,
  measureScene,
  parseDevToolsPort,
  readDevToolsPort,
  summaryLine,
} from './validateScenesBrowser.mjs';
import { menuRowsFailures, menuRowsProbe } from './validateScenesMenus.mjs';

const { Window } = createRequire(new URL('../apps/desktop/package.json', import.meta.url))(
  'happy-dom',
);

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

describe('failureLines', () => {
  it('prints the scene, the check and the details of every failure', () => {
    const failures = [
      { scene: 'agentlead', check: 'a menu trigger opens to fewer than two rows', short: [1] },
      { scene: 'inbox', check: 'task age wraps', width: 880 },
    ];
    assert.deepEqual(failureLines({ failures }), [
      'failure agentlead: a menu trigger opens to fewer than two rows {"short":[1]}',
      'failure inbox: task age wraps {"width":880}',
    ]);
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

const PROBE_PARAMS = {
  openMs: 300,
  closeMs: 200,
  bootMs: 500,
  perKind: 3,
  maxTriggers: 60,
  budgetMs: 5000,
};

const ROOMY = { width: 24, height: 24, top: 0, left: 0, right: 24, bottom: 24 };

const buildPage = ({ menus }) => {
  const window = new Window();
  window.HTMLElement.prototype.getBoundingClientRect = () => ROOMY;
  const { document } = window;
  for (const menu of menus) {
    const trigger = document.createElement('button');
    trigger.setAttribute('aria-haspopup', menu.popup ?? 'menu');
    trigger.setAttribute('aria-label', menu.label);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.className = menu.className ?? 'trigger';
    let panel = null;
    const close = () => {
      panel?.remove();
      panel = null;
      trigger.setAttribute('aria-expanded', 'false');
    };
    const show = () => {
      panel = document.createElement('div');
      panel.setAttribute('role', 'menu');
      for (let index = 0; index < menu.items; index += 1) {
        const row = document.createElement('button');
        row.setAttribute('role', 'menuitem');
        panel.append(row);
      }
      document.body.append(panel);
      trigger.setAttribute('aria-expanded', 'true');
    };
    trigger.addEventListener('click', () => {
      if (panel !== null) {
        close();
        return;
      }
      window.setTimeout(show, menu.renderDelayMs ?? 0);
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    document.body.append(trigger);
    if (menu.isOpenAtLoad === true) show();
  }
  return window;
};

const probePage = async ({ menus, overrides = {} }) => {
  const window = buildPage({ menus });
  const params = JSON.stringify({ ...PROBE_PARAMS, ...overrides });
  const probe = await window.eval(
    `(async () => JSON.stringify(await (${menuRowsProbe.toString()})(${params})))()`,
  );
  await window.happyDOM.close();
  return JSON.parse(probe);
};

describe('menuRowsProbe', () => {
  it('fails a menu trigger that opens to one row', async () => {
    const probe = await probePage({ menus: [{ label: 'Row actions', items: 1 }] });
    const failures = menuRowsFailures({ scene: 'fixture', probe });

    assert.equal(failures.length, 1);
    assert.equal(failures[0].scene, 'fixture');
    assert.deepEqual(failures[0].short, [{ trigger: 'Row actions', isOpen: true, rows: 1 }]);
  });

  it('passes menus of two or more rows', async () => {
    const probe = await probePage({
      menus: [
        { label: 'First', items: 2 },
        { label: 'Second', items: 5 },
      ],
    });

    assert.equal(probe.tested, 2);
    assert.deepEqual(menuRowsFailures({ scene: 'fixture', probe }), []);
  });

  it('waits for a menu that renders after the click', async () => {
    const probe = await probePage({
      menus: [{ label: 'Slow', items: 3, renderDelayMs: 120 }],
    });

    assert.deepEqual(
      probe.results.map(({ trigger, rows }) => [trigger, rows]),
      [['Slow', 3]],
    );
  });

  it('closes each menu before the next trigger, so rows never add up', async () => {
    const probe = await probePage({
      menus: [
        { label: 'Wide', items: 4, className: 'wide' },
        { label: 'Narrow', items: 1, className: 'narrow' },
      ],
    });

    assert.deepEqual(
      probe.results.map(({ trigger, rows }) => [trigger, rows]),
      [
        ['Wide', 4],
        ['Narrow', 1],
      ],
    );
  });

  it('opens a few triggers of a kind, not hundreds', async () => {
    const menus = Array.from({ length: 300 }, (_, index) => ({
      label: `More actions for file-${index}.ts`,
      items: 2,
    }));
    const probe = await probePage({ menus });

    assert.equal(probe.total, 300);
    assert.ok(probe.tested <= 3);
    assert.deepEqual(menuRowsFailures({ scene: 'fixture', probe }), []);
  });

  it('skips triggers that are not menus', async () => {
    const probe = await probePage({
      menus: [
        { label: 'Picker', items: 1, popup: 'dialog' },
        { label: 'Real menu', items: 2 },
      ],
    });

    assert.equal(probe.total, 1);
    assert.deepEqual(
      probe.results.map(({ trigger }) => trigger),
      ['Real menu'],
    );
  });

  it('measures a menu a scene left open instead of toggling it shut', async () => {
    const probe = await probePage({
      menus: [{ label: 'Open at load', items: 2, isOpenAtLoad: true }],
    });

    assert.deepEqual(
      probe.results.map(({ trigger, isOpen, rows }) => [trigger, isOpen, rows]),
      [['Open at load', true, 2]],
    );
  });

  it('fails a trigger that opens no menu at all', async () => {
    const probe = await probePage({ menus: [{ label: 'Dead', items: 0 }] });
    const failures = menuRowsFailures({ scene: 'fixture', probe });

    assert.equal(failures.length, 1);
    assert.equal(failures[0].short[0].rows, 0);
  });

  it('fails loudly when it runs out of time instead of passing a part', async () => {
    const probe = await probePage({
      menus: [{ label: 'Only', items: 2 }],
      overrides: { budgetMs: -1 },
    });
    const failures = menuRowsFailures({ scene: 'fixture', probe });

    assert.deepEqual(
      failures.map((failure) => failure.check),
      ['menu probe ran out of time'],
    );
  });
});
