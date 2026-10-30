import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import {
  ANNOTATION_LIMIT,
  DevToolsTimeoutError,
  SceneNotReadyError,
  annotationLines,
  failingScenes,
  failureLines,
  inboxAgeFailures,
  measureScene,
  notReadyFailure,
  parseDevToolsPort,
  readDevToolsPort,
  summaryLine,
  summaryMarkdown,
  timeCellFailures,
  unmeasuredFailures,
} from './validateScenesBrowser.mjs';
import { headerLineFailures } from './validateScenesHeaderLine.mjs';
import { updatePillFailures } from './validateScenesUpdatePill.mjs';
import { listGridFitFailures } from './validateScenesListGridFit.mjs';
import { drawerComposerFailures } from './validateScenesDrawerComposer.mjs';
import {
  COLUMN_ROW_SELECTOR,
  columnDriftFailures,
  columnEdgesProbe,
} from './validateScenesColumns.mjs';
import {
  FRAME_SCENES,
  frameFailures,
  frameProbe,
  frameSceneVariants,
  missingFrameScenes,
} from './validateScenesFrame.mjs';
import { LAYER_SCENES, layerFailures, layerScrollMoves } from './validateScenesLayers.mjs';
import { menuRowsFailures, menuRowsProbe } from './validateScenesMenus.mjs';
import { chatMeasureFailures } from './validateScenesChatMeasure.mjs';

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

describe('a scene that measured nothing', () => {
  it('prints crashed when a probe threw and no scene is named', () => {
    const crash = new Error('{"text":"Uncaught"}');
    assert.equal(
      summaryLine({ scenes: failingScenes({ failures: [], error: crash }), crash }),
      'scene measures: crashed',
    );
  });

  it('keeps naming the scene when the crash carries one', () => {
    const crash = new Error('scene activity-run: Runtime.evaluate timed out after 60s');
    assert.equal(
      summaryLine({ scenes: failingScenes({ failures: [], error: crash }), crash }),
      'scene measures: failed in activity-run',
    );
  });

  it('names a scene that never became ready, in the shape failingScenes reads', () => {
    const error = new SceneNotReadyError({ scene: 'confirmpopover&v=rich' });
    assert.equal(error.message, 'scene confirmpopover&v=rich: did not become ready');
    assert.deepEqual(failingScenes({ failures: [], error }), ['confirmpopover&v=rich']);
    assert.deepEqual(notReadyFailure({ error }), {
      scene: 'confirmpopover&v=rich',
      check: 'scene did not become ready',
    });
  });

  it('fails a subject count of zero and passes any other count', () => {
    assert.deepEqual(
      unmeasuredFailures({ scene: 'inbox', width: 880, subject: 'task ages', count: 0 }),
      [{ scene: 'inbox', width: 880, check: 'measured 0 task ages' }],
    );
    assert.deepEqual(unmeasuredFailures({ scene: 'inbox', subject: 'task ages', count: 3 }), []);
    assert.deepEqual(unmeasuredFailures({ scene: 'menus', subject: 'menu triggers', count: 0 }), [
      { scene: 'menus', check: 'measured 0 menu triggers' },
    ]);
  });

  it('fails an inbox with no task age, and a feed with no time cell', () => {
    assert.deepEqual(
      inboxAgeFailures({ width: 880, ages: { measured: 0, wrapped: [] } }).map((f) => f.check),
      ['measured 0 task ages'],
    );
    assert.deepEqual(
      timeCellFailures({
        scene: 'activity-run',
        width: 760,
        times: { measured: 0, clipped: [] },
      }).map((f) => f.check),
      ['measured 0 time cells'],
    );
  });

  it('still reports a real overlap, wrap or clip next to a measured subject', () => {
    assert.deepEqual(
      inboxAgeFailures({ width: 880, ages: { measured: 4, wrapped: [{ key: 'a' }] } }).map(
        (f) => f.check,
      ),
      ['task age wraps'],
    );
    assert.deepEqual(
      timeCellFailures({
        scene: 'activity-run',
        width: 760,
        times: { measured: 2, clipped: [{ row: 'r1' }] },
      }).map((f) => f.check),
      ['time wider than its column'],
    );
    assert.deepEqual(inboxAgeFailures({ width: 880, ages: { measured: 4, wrapped: [] } }), []);
  });
});

describe('annotationLines', () => {
  it('prints one error annotation per failure with the scene in the title', () => {
    const lines = annotationLines({
      failures: [{ scene: 'inbox', check: 'task age wraps', width: 880 }],
    });
    assert.deepEqual(lines, [
      '::error title=scene measures%3A inbox::task age wraps {"width":880}',
    ]);
  });

  it('escapes percent signs and newlines in the message', () => {
    const [line] = annotationLines({ failures: [{ scene: 'a', check: '100%\nwide' }] });
    assert.ok(line.includes('100%25%0Awide'));
    assert.ok(!line.includes('\n'));
  });

  it('caps the annotations and says how many more there are', () => {
    const failures = Array.from({ length: ANNOTATION_LIMIT + 3 }, (_, index) => ({
      scene: `scene-${index}`,
      check: 'x',
    }));
    const lines = annotationLines({ failures });
    assert.equal(lines.length, ANNOTATION_LIMIT + 1);
    assert.ok(lines.at(-1).includes('3 more failures'));
  });

  it('adds a crash annotation', () => {
    const lines = annotationLines({ failures: [], crash: new Error('Chrome did not open') });
    assert.deepEqual(lines, ['::error title=scene measures crashed::Chrome did not open']);
  });
});

describe('summaryMarkdown', () => {
  it('lists the failing scene ids and the duration', () => {
    const text = summaryMarkdown({ scenes: ['inbox', 'frame'], durationMs: 61_400 });
    assert.equal(
      text,
      'scene measures: failed in inbox, frame\n\nduration: 61s\n\nfailing scenes:\n- inbox\n- frame\n',
    );
  });

  it('says ok with the duration alone', () => {
    assert.equal(
      summaryMarkdown({ scenes: [], durationMs: 2000 }),
      'scene measures: ok\n\nduration: 2s\n',
    );
  });

  it('says crashed with the message', () => {
    assert.equal(
      summaryMarkdown({ scenes: [], crash: new Error('boom'), durationMs: 1000 }),
      'scene measures: crashed\n\nduration: 1s\n\ncrash: boom\n',
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

const PAGE_GLOBALS = ['window', 'document', 'getComputedStyle', 'KeyboardEvent'];

const runInWindow = async ({ window, probe, params }) => {
  const saved = PAGE_GLOBALS.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const key of PAGE_GLOBALS) {
    const value = key === 'window' ? window : key === 'document' ? window.document : window[key];
    Object.defineProperty(globalThis, key, {
      value: typeof value === 'function' ? value.bind(window) : value,
      configurable: true,
      writable: true,
    });
  }
  try {
    return JSON.parse(JSON.stringify((await probe(params)) ?? null));
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor === undefined) {
        delete globalThis[key];
        continue;
      }
      Object.defineProperty(globalThis, key, descriptor);
    }
  }
};

const probePage = async ({ menus, overrides = {} }) => {
  const window = buildPage({ menus });
  const probe = await runInWindow({
    window,
    probe: menuRowsProbe,
    params: { ...PROBE_PARAMS, ...overrides },
  });
  await window.happyDOM.close();
  return probe;
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

const columnRow = ({ row, model, stack, action }) => ({
  row,
  edges: { model, stack, action },
});

describe('columnDriftFailures', () => {
  it('passes rows whose three columns end on the same edge', () => {
    const rows = [
      columnRow({ row: 'a', model: 700, stack: 790, action: 870 }),
      columnRow({ row: 'b', model: 700.4, stack: 790, action: 870.2 }),
    ];
    assert.deepEqual(columnDriftFailures({ scene: 'fixture', width: 1440, rows }), []);
  });

  it('fails the rows of the 0.23.1 grammar, where Review plan made one row wider', () => {
    const rows = [
      columnRow({ row: 'step-1', model: 700, stack: 790, action: null }),
      columnRow({ row: 'step-2', model: 624, stack: 714, action: 870 }),
    ];
    const failures = columnDriftFailures({ scene: 'fixture', width: 1440, rows });
    assert.deepEqual(
      failures.map((failure) => failure.check),
      ['model column right edge drifts across rows', 'stack column right edge drifts across rows'],
    );
  });

  it('fails a feed that drew no rows at all', () => {
    assert.equal(columnDriftFailures({ scene: 'fixture', width: 1440, rows: [] }).length, 1);
  });
});

describe('columnEdgesProbe', () => {
  it('reads the right edge of each named column on every row', async () => {
    const window = new Window();
    window.document.body.innerHTML =
      '<div data-row-id="a"><span data-meta-column="model"></span></div>';
    const column = window.document.querySelector('[data-meta-column="model"]');
    column.getBoundingClientRect = () => ({ right: 321 });
    const rows = await runInWindow({
      window,
      probe: columnEdgesProbe,
      params: { names: ['model', 'action'], selector: COLUMN_ROW_SELECTOR },
    });
    assert.deepEqual(rows, [{ row: 'a', edges: { model: 321, action: null } }]);
    await window.happyDOM.close();
  });

  it('reads a run tree row by its test id', async () => {
    const window = new Window();
    window.document.body.innerHTML =
      '<div data-testid="run-tree-row-agent-1"><span data-meta-column="action"></span></div>';
    const column = window.document.querySelector('[data-meta-column="action"]');
    column.getBoundingClientRect = () => ({ right: 640 });
    const rows = await runInWindow({
      window,
      probe: columnEdgesProbe,
      params: { names: ['action'], selector: COLUMN_ROW_SELECTOR },
    });
    assert.deepEqual(rows, [{ row: 'run-tree-row-agent-1', edges: { action: 640 } }]);
    await window.happyDOM.close();
  });
});

const rect = ({ left, top, right, bottom }) => ({ left, top, right, bottom });

const framed = (overrides = {}) => ({
  hasSheet: true,
  sheet: rect({ left: 300, top: 0, right: 1440, bottom: 900 }),
  crumb: rect({ left: 340, top: 8, right: 440, bottom: 32 }),
  title: rect({ left: 340, top: 40, right: 500, bottom: 72 }),
  bodyChild: rect({ left: 340, top: 80, right: 1400, bottom: 400 }),
  trail: rect({ left: 340, top: 8, right: 1000, bottom: 32 }),
  rail: rect({ left: 0, top: 0, right: 288, bottom: 900 }),
  drawer: null,
  drawerRow: null,
  isDrawerInsidePage: false,
  composer: null,
  stage: null,
  detail: rect({ left: 300, top: 40, right: 1440, bottom: 900 }),
  slots: [
    {
      name: 'pane-header',
      isClipped: false,
      ...rect({ left: 340, top: 40, right: 1400, bottom: 72 }),
    },
  ],
  ...overrides,
});

const rulesOf = (measured) =>
  frameFailures({ scene: 'fixture', width: 1440, sidebar: 'pinned', measured }).map(
    (failure) => failure.rule,
  );

describe('frameProbe body edge', () => {
  const bodyLeft = async (html, lefts) => {
    const window = new Window();
    window.document.body.innerHTML = html;
    window.document.getAnimations = () => [];
    for (const [id, left] of Object.entries(lefts)) {
      window.document.getElementById(id).getBoundingClientRect = () => ({
        left,
        right: left + 600,
        top: 0,
        bottom: 100,
        width: 600,
      });
    }
    const measured = await runInWindow({ window, probe: frameProbe, params: null });
    await window.happyDOM.close();
    return measured.bodyChild.left;
  };

  it('adds the gutter of a padded body column', async () => {
    const html =
      '<div data-slot="pane-body"><div id="outer" data-page-column style="padding-left:24px"></div></div>';
    assert.equal(await bodyLeft(html, { outer: 340 }), 364);
  });

  it('reads the content edge inside a zero-padding body column', async () => {
    const html =
      '<div data-slot="pane-body"><div id="outer" data-page-column style="padding-left:0px">' +
      '<div id="inner" data-page-column style="padding-left:24px"></div></div></div>';
    assert.equal(await bodyLeft(html, { outer: 340, inner: 340 }), 364);
  });

  it('falls back to the column edge when a zero-padding column holds no column', async () => {
    const html =
      '<div data-slot="pane-body"><div id="outer" data-page-column style="padding-left:0px"></div></div>';
    assert.equal(await bodyLeft(html, { outer: 340 }), 340);
  });
});

describe('frameFailures', () => {
  it('passes a frame whose crumb, title and body share one edge', () => {
    assert.deepEqual(rulesOf(framed()), []);
  });

  it('names rule 1 when the crumb starts left of the title', () => {
    assert.deepEqual(
      rulesOf(framed({ crumb: rect({ left: 144, top: 8, right: 240, bottom: 32 }) })),
      ['rule 1'],
    );
  });

  it('aligns the h1 and the body alone on a page without a crumb', () => {
    assert.deepEqual(rulesOf(framed({ crumb: null })), []);
    assert.deepEqual(
      rulesOf(framed({ crumb: null, title: rect({ left: 344, top: 40, right: 500, bottom: 72 }) })),
      ['rule 1'],
    );
  });

  it('names rule 1 when the h1 is missing, and skips the spread check', () => {
    assert.deepEqual(rulesOf(framed({ title: null })), ['rule 1']);
  });

  it('skips the missing crumb check for a bare pane scene', () => {
    const measured = framed({ crumb: null, title: null });
    const rules = frameFailures({
      scene: 'fixture',
      width: 1440,
      sidebar: 'pinned',
      measured,
      isBare: true,
    }).map((failure) => failure.rule);
    assert.deepEqual(rules, []);
  });

  it('names rule 1 once when both the crumb and the h1 are missing', () => {
    assert.deepEqual(rulesOf(framed({ crumb: null, title: null })), ['rule 1']);
  });

  it('compares the crumb and the title alone when the page has no body column', () => {
    const crumb = rect({ left: 363, top: 8, right: 440, bottom: 32 });
    assert.deepEqual(rulesOf(framed({ bodyChild: null, crumb })), ['rule 1']);
    assert.deepEqual(rulesOf(framed({ bodyChild: null })), []);
  });

  it('allows one pixel of drift on rule 1 and fails two', () => {
    const crumb = (left) => rect({ left, top: 8, right: left + 100, bottom: 32 });
    assert.deepEqual(rulesOf(framed({ crumb: crumb(341) })), []);
    assert.deepEqual(rulesOf(framed({ crumb: crumb(342.5) })), ['rule 1']);
  });

  it('fails a scene with no page container instead of passing silently', () => {
    assert.deepEqual(rulesOf(framed({ hasSheet: false })), ['sheet']);
  });

  it('fails a slot that leaves the sheet sideways, and spares one clipped by a scroller below', () => {
    const wide = {
      name: 'wide',
      isClipped: false,
      ...rect({ left: 340, top: 40, right: 1500, bottom: 72 }),
    };
    const below = {
      name: 'below',
      isClipped: true,
      ...rect({ left: 340, top: 1200, right: 1400, bottom: 1300 }),
    };
    const fallen = {
      name: 'fallen',
      isClipped: false,
      ...rect({ left: 340, top: 1200, right: 1400, bottom: 1300 }),
    };
    assert.deepEqual(rulesOf(framed({ slots: [wide] })), ['slots inside the sheet']);
    assert.deepEqual(rulesOf(framed({ slots: [below] })), []);
    assert.deepEqual(rulesOf(framed({ slots: [fallen] })), ['slots inside the sheet']);
  });

  it('spares a slot scrolled out sideways by a horizontal scroller', () => {
    const scrolled = {
      name: 'scrolled',
      isClipped: false,
      isClippedX: true,
      ...rect({ left: 80, top: 200, right: 230, bottom: 224 }),
    };
    assert.deepEqual(rulesOf(framed({ slots: [scrolled] })), []);
  });

  it('fails a rail that overlaps the crumb band and spares one that only touches it', () => {
    assert.deepEqual(
      rulesOf(framed({ rail: rect({ left: 0, top: 0, right: 400, bottom: 900 }) })),
      ['rail over crumb'],
    );
    assert.deepEqual(
      rulesOf(framed({ rail: rect({ left: 0, top: 0, right: 340, bottom: 900 }) })),
      [],
    );
  });

  it('fails a drawer header whose centre is off the crumb row centre by more than a pixel', () => {
    const drawerRow = (top) => rect({ left: 1100, top, right: 1400, bottom: top + 24 });
    assert.deepEqual(rulesOf(framed({ drawerRow: drawerRow(8) })), []);
    assert.deepEqual(rulesOf(framed({ drawerRow: drawerRow(13) })), ['crumb and drawer header']);
  });

  it('fails a composer that ends below the sheet', () => {
    const composer = (bottom) => rect({ left: 340, top: bottom - 80, right: 1400, bottom });
    assert.deepEqual(rulesOf(framed({ composer: composer(900) })), []);
    assert.deepEqual(rulesOf(framed({ composer: composer(940) })), ['composer']);
  });

  it('fails a drawer hosted inside the page container', () => {
    assert.deepEqual(rulesOf(framed({ isDrawerInsidePage: true })), ['drawer container']);
  });

  it('fails an empty chat stage off the detail centre in x or outside 40 to 52 percent in y', () => {
    const stage = ({ left, top }) => rect({ left, top, right: left + 400, bottom: top + 200 });
    assert.deepEqual(rulesOf(framed({ stage: stage({ left: 670, top: 340 }) })), []);
    assert.deepEqual(rulesOf(framed({ stage: stage({ left: 600, top: 340 }) })), [
      'chat empty stage',
    ]);
    assert.deepEqual(rulesOf(framed({ stage: stage({ left: 670, top: 100 }) })), [
      'chat empty stage',
    ]);
    assert.deepEqual(rulesOf(framed({ stage: stage({ left: 670, top: 520 }) })), [
      'chat empty stage',
    ]);
  });

  it('names the scene, the width and the sidebar in every failure', () => {
    const [failure] = frameFailures({
      scene: 'guide',
      width: 1100,
      sidebar: 'rail',
      measured: framed({ hasSheet: false }),
    });
    assert.deepEqual(
      [failure.scene, failure.width, failure.sidebar, failure.rule],
      ['guide', 1100, 'rail', 'sheet'],
    );
  });
});

describe('the frame probe scene list', () => {
  it('lists each scene once, with the pages that once had no page container', () => {
    const ids = FRAME_SCENES.map((entry) => entry.scene);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.length >= 22 && ids.length <= 34);
    for (const scene of [
      'scripts-rows',
      'monitoring-ports',
      'terminal-studio',
      'agent-running-stop',
      'branch-commits',
      'branch-files',
      'branch-open',
    ]) {
      assert.ok(ids.includes(scene), scene);
    }
  });

  it('measures a scene pinned, and on the rail only when it has a rail query', () => {
    assert.deepEqual(
      frameSceneVariants({ entry: { scene: 'a', rail: '&rail=1' } }).map((variant) => variant.url),
      ['a', 'a&rail=1'],
    );
    assert.deepEqual(
      frameSceneVariants({ entry: { scene: 'a', rail: null } }).map((variant) => variant.sidebar),
      ['pinned'],
    );
  });

  it('names a scene missing from scenes.txt, query stripped', () => {
    const entries = [
      { scene: 'known&view=x', rail: null },
      { scene: 'ghost', rail: null },
    ];
    assert.deepEqual(missingFrameScenes({ ids: ['known'], entries }), ['ghost']);
  });

  it('finds every listed scene in scenes.txt', () => {
    const ids = readFileSync(
      new URL('../apps/desktop/src/app/components/MockScene/scenes.txt', import.meta.url),
      'utf8',
    ).split('\n');
    assert.deepEqual(missingFrameScenes({ ids }), []);
  });
});

const chatEdges = ({ left, right }) => ({ left, right });

const alignedChat = () => ({
  header: chatEdges({ left: 911, right: 1620 }),
  title: chatEdges({ left: 911, right: 1174 }),
  remove: chatEdges({ left: 1592, right: 1620 }),
  messages: chatEdges({ left: 911, right: 1620 }),
  copy: chatEdges({ left: 1600, right: 1620 }),
  composer: chatEdges({ left: 911, right: 1620 }),
});

describe('chatMeasureFailures', () => {
  it('passes a room whose header, thread and composer share one column', () => {
    assert.deepEqual(
      chatMeasureFailures({ scene: 'fixture', width: 2000, probe: alignedChat() }),
      [],
    );
  });

  it('fails a room whose thread runs on the wider list column', () => {
    const probe = { ...alignedChat(), messages: chatEdges({ left: 788, right: 1748 }) };
    assert.deepEqual(
      chatMeasureFailures({ scene: 'fixture', width: 2000, probe }).map((failure) => failure.check),
      [
        'chat header, thread and composer start on different left edges',
        'chat header, thread and composer end on different right edges',
      ],
    );
  });

  it('fails a room with no thread or a missing control', () => {
    assert.equal(
      chatMeasureFailures({ scene: 'fixture', width: 1100, probe: null })[0]?.check,
      'no chat room to measure',
    );
    const probe = { ...alignedChat(), remove: null };
    assert.equal(
      chatMeasureFailures({ scene: 'fixture', width: 1100, probe })[0]?.check,
      'chat room is missing remove',
    );
  });
});

describe('headerLineFailures', () => {
  const line = ({ top }) => ({ top, centre: top + 16 });
  const measured = {
    rail: line({ top: 49 }),
    title: line({ top: 49 }),
    tool: line({ top: 49.5 }),
    drawer: line({ top: 49 }),
  };

  it('passes four header rows on one line within a pixel', () => {
    assert.deepEqual(headerLineFailures({ scene: 'fixture', width: 1440, measured }), []);
  });

  it('fails a drawer header that sits on its own line', () => {
    const drawer = { top: 42, centre: 56 };
    const checks = headerLineFailures({
      scene: 'fixture',
      width: 1100,
      measured: { ...measured, drawer },
    }).map((failure) => failure.check);
    assert.equal(checks.length, 2);
  });

  it('fails a scene that does not show all four rows', () => {
    const failures = headerLineFailures({
      scene: 'fixture',
      width: 1100,
      measured: { ...measured, tool: null },
    });
    assert.deepEqual(failures[0]?.missing, ['tool']);
  });
});

describe('updatePillFailures', () => {
  const measured = {
    pill: { left: 48, right: 112, top: 868, height: 20 },
    row: { left: 16, right: 184, top: 864, height: 28 },
    bug: { left: 164, right: 188, top: 866, height: 24 },
    versionHeight: 16,
    lineHeight: 16,
    versionScroll: 34,
    versionClient: 34,
    text: '0.27.2',
  };

  it('passes a pill that keeps its whole version on one line inside the row', () => {
    assert.deepEqual(updatePillFailures({ scene: 'fixture', width: 1024, measured }), []);
  });

  it('fails a version that wraps onto a second line', () => {
    const checks = updatePillFailures({
      scene: 'fixture',
      width: 1024,
      measured: { ...measured, versionHeight: 32 },
    }).map((failure) => failure.check);
    assert.deepEqual(checks, ['the update pill holds its version on one line']);
  });

  it('fails a truncated version and a pill that runs out of its row', () => {
    const checks = updatePillFailures({
      scene: 'fixture',
      width: 1024,
      measured: {
        ...measured,
        versionClient: 20,
        pill: { ...measured.pill, right: 190 },
      },
    }).map((failure) => failure.check);
    assert.deepEqual(checks, [
      'the update pill shows its whole version',
      'the update pill stays inside the Goodboy row',
      'the update pill never runs under the bug button',
    ]);
  });

  it('fails a scene without the pill', () => {
    assert.equal(
      updatePillFailures({ scene: 'fixture', width: 1024, measured: null })[0]?.check,
      'the Goodboy row shows the update pill',
    );
  });
});

describe('drawerComposerFailures', () => {
  const control = (name, left, right) => ({ name, left, right, top: 800, bottom: 828, height: 28 });
  const measured = {
    toolbar: { name: '', left: 1060, right: 1400, top: 800, bottom: 828, height: 28 },
    drawer: { name: '', left: 1048, right: 1432, top: 40, bottom: 890, height: 850 },
    controls: [
      control('Add', 1076, 1104),
      control('Model routing', 1120, 1170),
      control('Send now', 1180, 1260),
      control('Queue', 1270, 1340),
    ],
  };

  it('passes controls that hold one row of one height inside the drawer', () => {
    assert.deepEqual(drawerComposerFailures({ scene: 'fixture', width: 1440, measured }), []);
  });

  it('fails controls that overlap and one that runs past the drawer edge', () => {
    const checks = drawerComposerFailures({
      scene: 'fixture',
      width: 1440,
      measured: {
        ...measured,
        controls: [control('Model routing', 1120, 1200), control('Send now', 1180, 1440)],
      },
    }).map((failure) => failure.check);
    assert.deepEqual(checks, [
      'every toolbar control stays inside the toolbar',
      'no toolbar control runs past the drawer edge',
      'no two toolbar controls overlap',
    ]);
  });

  it('fails a button taller than its neighbours', () => {
    const tall = { ...control('Queue', 1270, 1340), height: 48, bottom: 848 };
    const checks = drawerComposerFailures({
      scene: 'fixture',
      width: 1440,
      measured: { ...measured, controls: [measured.controls[2], tall] },
    }).map((failure) => failure.check);
    assert.deepEqual(checks, ['every toolbar button has the same height']);
  });

  it('fails a scene without a drawer composer', () => {
    assert.equal(
      drawerComposerFailures({ scene: 'fixture', width: 1440, measured: null })[0]?.check,
      'the drawer shows a composer toolbar',
    );
  });
});

const lightboxEntry = LAYER_SCENES.find((entry) => entry.scene === 'image-lightbox');

const onTop = ({ focusables = 2 } = {}) => ({
  rect: { left: 0, top: 0, width: 1100, height: 1000 },
  isHit: true,
  hitTag: 'img',
  focusables,
  backdrop: { x: 4, y: 4 },
  scrollers: [],
});

const stayed = { isInside: true, tag: 'button', name: 'Close' };

describe('the layer probe scene list', () => {
  it('covers the drawer, the notifications popover, the palette and the lightbox', () => {
    assert.deepEqual(
      LAYER_SCENES.map((entry) => entry.label),
      ['drawer over the page', 'notifications popover', 'command palette', 'image lightbox'],
    );
  });

  it('finds every listed scene in scenes.txt', () => {
    const ids = readFileSync(
      new URL('../apps/desktop/src/app/components/MockScene/scenes.txt', import.meta.url),
      'utf8',
    ).split('\n');
    assert.deepEqual(
      LAYER_SCENES.map((entry) => entry.scene.split('&')[0]).filter((id) => !ids.includes(id)),
      [],
    );
  });
});

describe('layerScrollMoves', () => {
  it('names each scroller whose top changed', () => {
    assert.deepEqual(
      layerScrollMoves({
        before: [
          { index: -1, top: 0 },
          { index: 4, top: 30 },
        ],
        after: [
          { index: -1, top: 0 },
          { index: 4, top: 630 },
        ],
      }),
      [{ index: 4, from: 30, to: 630 }],
    );
  });

  it('ignores a scroller that did not move or was not there before', () => {
    assert.deepEqual(
      layerScrollMoves({
        before: [{ index: 2, top: 10 }],
        after: [
          { index: 2, top: 10 },
          { index: 9, top: 50 },
        ],
      }),
      [],
    );
  });
});

describe('layerFailures', () => {
  it('passes a layer on top, with Tab kept inside and nothing scrolled behind', () => {
    assert.deepEqual(
      layerFailures({
        entry: lightboxEntry,
        measured: { layer: onTop(), tabs: [stayed, stayed, stayed], moves: [] },
      }),
      [],
    );
  });

  it('fails a layer that is not on screen', () => {
    assert.deepEqual(
      layerFailures({
        entry: lightboxEntry,
        measured: { layer: null, tabs: [], moves: [] },
      }).map((failure) => failure.check),
      ['the image lightbox is on screen'],
    );
  });

  it('fails when something else is on top at the centre of the layer', () => {
    const [failure] = layerFailures({
      entry: lightboxEntry,
      measured: { layer: { ...onTop(), isHit: false, hitTag: 'main' }, tabs: [stayed], moves: [] },
    });
    assert.equal(failure.check, 'the image lightbox is the topmost thing at its centre');
    assert.equal(failure.hit, 'main');
  });

  it('fails when Tab reaches the page, naming the press', () => {
    const [failure] = layerFailures({
      entry: lightboxEntry,
      measured: {
        layer: onTop(),
        tabs: [stayed, { isInside: false, tag: 'button', name: 'Open preview' }],
        moves: [],
      },
    });
    assert.equal(failure.check, 'Tab stays inside the image lightbox');
    assert.equal(failure.press, 2);
  });

  it('fails a modal layer with nothing to focus', () => {
    assert.deepEqual(
      layerFailures({
        entry: lightboxEntry,
        measured: { layer: onTop({ focusables: 0 }), tabs: [], moves: [] },
      }).map((failure) => failure.check),
      ['the image lightbox holds something to focus'],
    );
  });

  it('fails when a wheel on the backdrop scrolls the page behind', () => {
    const [failure] = layerFailures({
      entry: lightboxEntry,
      measured: {
        layer: onTop(),
        tabs: [stayed],
        moves: [{ index: -1, from: 0, to: 600 }],
      },
    });
    assert.equal(failure.check, 'a wheel on the image lightbox backdrop scrolls nothing behind it');
  });

  it('does not hold a popover to Tab containment or the wheel rule', () => {
    const popover = LAYER_SCENES.find((entry) => entry.scene.startsWith('notifications'));
    assert.deepEqual(
      layerFailures({
        entry: popover,
        measured: {
          layer: onTop({ focusables: 0 }),
          tabs: [{ isInside: false, tag: 'button', name: 'Bell' }],
          moves: [{ index: -1, from: 0, to: 600 }],
        },
      }),
      [],
    );
  });
});

describe('listGridFitFailures', () => {
  const grid = {
    label: 'Runs',
    right: 648,
    rows: [
      { label: 'Fix flaky tests', right: 640 },
      { label: 'Write the docs', right: 648 },
    ],
  };

  it('passes rows that end inside their list', () => {
    assert.deepEqual(listGridFitFailures({ scene: 'fixture', width: 1024, grids: [grid] }), []);
  });

  it('fails a row whose last cell runs past the list edge', () => {
    const failures = listGridFitFailures({
      scene: 'fixture',
      width: 1024,
      grids: [{ ...grid, rows: [...grid.rows, { label: 'Archived', right: 676 }] }],
    });
    assert.deepEqual(
      failures.map((failure) => failure.check),
      ['a row of the Runs list runs past its right edge'],
    );
    assert.deepEqual(failures[0]?.rows, [{ row: 'Archived', right: 676 }]);
  });

  it('fails a scene with no list to measure', () => {
    assert.deepEqual(
      listGridFitFailures({ scene: 'fixture', width: 1024, grids: [] }).map((failure) => failure.check),
      ['no list grid to measure'],
    );
  });
});
