import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CALL_TIMEOUT_MS,
  DevToolsTimeoutError,
  WARM_UP_TIMEOUT_MS,
  failingScenes,
  failureLines,
  measureScene,
  readDevToolsPort,
  summaryLine,
} from './validateScenesBrowser.mjs';
import { menuRowsFailures, menuRowsProbe } from './validateScenesMenus.mjs';

const CHROME =
  process.env.VALIDATE_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ZOOMS = [1, 1.1];
const WIDTHS = [1440, 1200, 1024, 880, 760];
const HEIGHT = 1000;
const WORKFLOW_SCROLL_HEIGHT = 520;
const STILL_CAP_PX = 1;
const SEAM_TOLERANCE_PX = 0.05;
const META_GAP_CAP_PX = 80;
const PLAN_DRAWER_SCENES = [
  { scene: 'plan-drawer-waiting', until: null },
  { scene: 'plan-drawer-drafts', until: null },
  { scene: 'plan-drawer-revising', until: null },
  { scene: 'plan-drawer-question', until: null },
  { scene: 'plan-drawer-conflict', until: '·' },
];
const PLAN_DRAWER_WIDTH = 1024;
const ROW_TOLERANCE_PX = 2;
const SETTLE_MS = 500;
const OPEN_ATTEMPTS = 3;
const WARM_UP_SCENE = 'workspace';
const WARM_UP_POLL_BUDGET_MS = 80_000;
const CLOSE_GRACE_MS = 5_000;
const FRAME_FALLBACK_MS = 100;
const CLICK_PATIENCE_MS = 8000;
const CONFIRM_VARIANTS = ['notifications', 'sessiondelete', 'chatrow', 'rich', 'activity', 'note'];
const ARM_SETTLE_MS = 250;
const LAYOUT_TOLERANCE_PX = 0.5;
const MENU_SCENE_SETTLE_MS = 100;
const MENU_PROBE_PARAMS = {
  openMs: 1500,
  closeMs: 800,
  bootMs: 15_000,
  perKind: 3,
  maxTriggers: 60,
  budgetMs: 40_000,
};
const SCENE_LIST = fileURLToPath(
  new URL('../apps/desktop/src/app/components/MockScene/scenes.txt', import.meta.url),
);

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((value, index, values) => [value.replace(/^--/, ''), values[index + 1]])
    .filter(([key]) => key),
);
const app = args.app ?? 'http://localhost:5230';
const wait = Number(args.wait ?? 2500);
const only = args.only;

const pause = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const connect = async (port) => {
  let targets = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      break;
    } catch {
      await pause(100);
    }
  }
  const target = targets.find((item) => item.type === 'page');
  if (!target) throw new Error(`Chrome did not open on ${port}`);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise);
    socket.addEventListener('error', () => reject(new Error('Chrome DevTools connection failed')));
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!Number.isInteger(message.id)) return;
    const resolvePending = pending.get(message.id);
    if (typeof resolvePending === 'function') {
      pending.delete(message.id);
      resolvePending(message);
    }
  });
  const send = (method, params = {}, timeoutMs = CALL_TIMEOUT_MS) =>
    new Promise((resolvePromise, reject) => {
      id += 1;
      const callId = id;
      const timer = setTimeout(() => {
        pending.delete(callId);
        reject(new DevToolsTimeoutError({ method, timeoutMs }));
      }, timeoutMs);
      pending.set(callId, (message) => {
        clearTimeout(timer);
        resolvePromise(message);
      });
      socket.send(JSON.stringify({ id: callId, method, params }));
    });
  return { send, disconnect: () => socket.close() };
};

const browser = async () => {
  const profile = mkdtempSync(join(tmpdir(), 'validate-scenes-'));
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: true },
  );
  const exited = new Promise((resolvePromise) => {
    child.once('exit', resolvePromise);
  });
  const killGroup = (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      return false;
    }
    return true;
  };
  let disconnect = () => {};
  const close = async () => {
    disconnect();
    killGroup('SIGTERM');
    const patience = new Promise((resolvePromise) => {
      setTimeout(() => resolvePromise(false), CLOSE_GRACE_MS).unref();
    });
    const isStopped = await Promise.race([exited.then(() => true), patience]);
    if (!isStopped) {
      killGroup('SIGKILL');
      await exited;
    }
    killGroup('SIGKILL');
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      console.warn(`validate-scenes: could not remove ${profile}`);
    }
  };
  try {
    const port = await readDevToolsPort({ profile });
    const connection = await connect(port);
    disconnect = connection.disconnect;
    return { send: connection.send, close };
  } catch (error) {
    await close();
    throw error;
  }
};

const run = async (send, fn, argument, timeoutMs = CALL_TIMEOUT_MS) => {
  const result = await send(
    'Runtime.evaluate',
    {
      expression: `(${fn.toString()})(${JSON.stringify(argument)})`,
      awaitPromise: true,
      returnByValue: true,
    },
    timeoutMs,
  );
  if (result.result?.exceptionDetails) {
    throw new Error(JSON.stringify(result.result.exceptionDetails).slice(0, 400));
  }
  return result.result?.result?.value;
};

const attemptOpen = async ({ send, scene, readySelector, settleMs }) => {
  try {
    await send('Page.navigate', { url: `${app}/?scene=${scene}&brand=1` });
    await pause(settleMs);
    return await run(
      send,
      async (selector) => {
        for (let poll = 0; poll < 100; poll += 1) {
          if (document.querySelector(selector) !== null) return true;
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
        }
        return false;
      },
      readySelector,
    );
  } catch (error) {
    if (error instanceof DevToolsTimeoutError) throw error;
    return false;
  }
};

const open = async ({
  send,
  scene,
  width,
  zoom,
  height = HEIGHT,
  readySelector = '[data-row-id]',
  settleMs = wait,
}) => {
  await send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(width / zoom),
    height: Math.round(height / zoom),
    deviceScaleFactor: 2 * zoom,
    mobile: false,
  });
  await send('Page.enable');
  for (let attempt = 0; attempt < OPEN_ATTEMPTS; attempt += 1) {
    const isReady = await attemptOpen({ send, scene, readySelector, settleMs });
    if (isReady) return;
  }
};

const clickButton = async ({ label, patience = 0 }) => {
  const deadline = performance.now() + patience;
  for (;;) {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (button instanceof HTMLElement) {
      button.click();
      return true;
    }
    if (performance.now() >= deadline) return false;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
};

const workflowScrollProbe = () => {
  const content = document.querySelector('[data-testid="workflow-rules"]');
  if (!(content instanceof HTMLElement)) return null;
  let scroller = content.parentElement;
  while (scroller !== null && scroller.scrollHeight <= scroller.clientHeight + 1) {
    scroller = scroller.parentElement;
  }
  if (scroller === null) return null;
  const box = scroller.getBoundingClientRect();
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    before: scroller.scrollTop,
  };
};

const workflowScrollResult = () => {
  const content = document.querySelector('[data-testid="workflow-rules"]');
  if (!(content instanceof HTMLElement)) return null;
  let scroller = content.parentElement;
  while (scroller !== null && scroller.scrollHeight <= scroller.clientHeight + 1) {
    scroller = scroller.parentElement;
  }
  if (scroller === null) return null;
  const maximum = scroller.scrollHeight - scroller.clientHeight;
  return {
    top: scroller.scrollTop,
    maximum,
    reached: maximum > 0 && scroller.scrollTop >= maximum - 2,
  };
};

const validateWorkflowScroll = async ({ send, scene, click }) => {
  await open({
    send,
    scene,
    width: 880,
    zoom: 1,
    height: WORKFLOW_SCROLL_HEIGHT,
    readySelector: '[data-studio-overlay]',
  });
  if (click !== null) {
    const clicked = await run(send, clickButton, { label: click, patience: CLICK_PATIENCE_MS });
    if (!clicked) return { reached: false, reason: `missing ${click} button` };
    await pause(SETTLE_MS);
  }
  const show = await run(send, clickButton, { label: 'Show' });
  if (show) await pause(SETTLE_MS);
  const probe = await run(send, workflowScrollProbe, null);
  if (probe === null) return { reached: false, reason: 'missing workflow scroller' };
  for (let index = 0; index < 12; index += 1) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: probe.x,
      y: probe.y,
      deltaX: 0,
      deltaY: 700,
    });
    await pause(40);
  }
  return (
    (await run(send, workflowScrollResult, null)) ?? {
      reached: false,
      reason: 'workflow scroller disappeared',
    }
  );
};

const planDrawerHeader = async ({ until, tolerance }) => {
  const find = () => document.querySelector('[data-testid="plan-drawer-toolbar"]');
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const version = document.querySelector('[data-testid="plan-drawer-version"]');
    if (find() !== null && (until === null || (version?.textContent ?? '').includes(until))) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  const toolbar = find();
  if (!(toolbar instanceof HTMLElement)) return { missing: true };
  const card = toolbar.closest('[data-drawer-card]');
  const box = toolbar.getBoundingClientRect();
  const children = [...toolbar.children]
    .filter((child) => child.getBoundingClientRect().width > 0)
    .map((child) => {
      const rect = child.getBoundingClientRect();
      return {
        label: (child.textContent ?? '').trim().slice(0, 24),
        centre: rect.top + rect.height / 2,
        right: rect.right,
        left: rect.left,
      };
    });
  const centres = children.map((child) => child.centre);
  const title = card?.querySelector('h2') ?? null;
  const lineHeight = title === null ? 0 : parseFloat(getComputedStyle(title).lineHeight);
  return {
    missing: false,
    cardWidth: card === null ? null : Math.round(card.getBoundingClientRect().width),
    rowSpread: Math.max(...centres) - Math.min(...centres),
    overflow: toolbar.scrollWidth - toolbar.clientWidth,
    pastEdge: children.filter((child) => child.right > box.right + 0.5).map((child) => child.label),
    titleLines:
      title === null || lineHeight === 0
        ? 0
        : Math.round(title.getBoundingClientRect().height / lineHeight),
    tolerance,
  };
};

const openEveryGroup = async ({ stillCap, settleMs, frameFallbackMs }) => {
  const frame = () =>
    new Promise((resolvePromise) => {
      requestAnimationFrame(resolvePromise);
      setTimeout(resolvePromise, frameFallbackMs);
    });
  const drifts = [];
  const toggles = () => [
    ...document.querySelectorAll('[data-row-id] button[aria-expanded="false"]'),
  ];
  const watch = async ({ row, top }) => {
    let drift = 0;
    const start = performance.now();
    while (performance.now() - start < 400) {
      await frame();
      drift = Math.max(drift, Math.abs(row.getBoundingClientRect().top - top));
    }
    return drift;
  };
  const visited = new Set();
  for (
    let next = toggles()[0];
    next !== undefined;
    next = toggles().find((button) => !visited.has(button.closest('[data-row-id]')?.dataset.rowId))
  ) {
    const row = next.closest('[data-row-id]');
    if (row === null || visited.has(row.dataset.rowId)) break;
    visited.add(row.dataset.rowId);
    row.scrollIntoView({ block: 'center' });
    await frame();
    const top = row.getBoundingClientRect().top;
    next.click();
    const opening = await watch({ row, top });
    next.click();
    const closing = await watch({ row, top });
    next.click();
    await watch({ row, top });
    drifts.push({ row: row.dataset.rowId, opening, closing });
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, settleMs));
  const transformed = [...document.querySelectorAll('[data-row-id]')]
    .filter((row) => getComputedStyle(row).transform !== 'none')
    .map((row) => row.dataset.rowId);
  return {
    transformed,
    moved: drifts.filter((drift) => Math.max(drift.opening, drift.closing) > stillCap),
    groups: drifts.length,
  };
};

const railSeams = ({ tolerance }) => {
  const rows = [...document.querySelectorAll('[data-row-id]')];
  const toScreen = ({ element, x, y }) => {
    const svg = element.ownerSVGElement;
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(element.getScreenCTM());
  };
  const ends = (path) => {
    const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    return [
      { x: numbers[0], y: numbers[1] },
      { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] },
    ].map((point) => toScreen({ element: path, ...point }));
  };
  const edgeXs = ({ row, edge }) => {
    const box = row.getBoundingClientRect();
    const fromLines = [...row.querySelectorAll('svg line')].flatMap((line) => {
      const rect = line.getBoundingClientRect();
      const reaches = edge === 'top' ? rect.top <= box.top + 0.5 : rect.bottom >= box.bottom - 0.5;
      return reaches ? [rect.left + rect.width / 2] : [];
    });
    const fromPaths = [...row.querySelectorAll('svg path')]
      .filter(
        (path) =>
          path.closest('[data-node-state]') === null && path.getAttribute('fill') === 'none',
      )
      .flatMap((path) =>
        ends(path).flatMap((point) =>
          edge === 'top' && point.y <= box.top + 0.5 ? [point.x] : [],
        ),
      );
    return [...fromLines, ...fromPaths];
  };
  const seams = [];
  for (let index = 0; index < rows.length - 1; index += 1) {
    const upper = rows[index];
    const lower = rows[index + 1];
    if (Math.abs(upper.getBoundingClientRect().bottom - lower.getBoundingClientRect().top) > 0.5) {
      continue;
    }
    const below = edgeXs({ row: lower, edge: 'top' });
    const missing = edgeXs({ row: upper, edge: 'bottom' }).filter(
      (x) => !below.some((other) => Math.abs(other - x) <= tolerance),
    );
    if (missing.length > 0) {
      seams.push({ upper: upper.dataset.rowId, lower: lower.dataset.rowId, missing });
    }
  }
  return seams;
};

const metaGaps = ({ cap }) =>
  [...document.querySelectorAll('[data-row-id]')].flatMap((row) => {
    const routing = row.querySelector('[data-meta-column="routing"]');
    const time = row.querySelector('[data-testid="work-time"]');
    if (routing === null || time === null) return [];
    const parts = [...routing.querySelectorAll('[data-routing-part]')].filter(
      (part) => part.getBoundingClientRect().width > 0,
    );
    if (parts.length === 0) return [];
    const modelEnd = Math.max(...parts.map((part) => part.getBoundingClientRect().right));
    const gap = time.getBoundingClientRect().left - modelEnd;
    return gap > cap ? [{ row: row.dataset.rowId, gap: Math.round(gap) }] : [];
  });

const clippedTimes = () =>
  [...document.querySelectorAll('[data-meta-column="time"]')].flatMap((cell) =>
    cell.scrollWidth > cell.clientWidth + 0.5
      ? [{ row: cell.closest('[data-row-id]')?.dataset.rowId ?? null, text: cell.textContent }]
      : [],
  );

const wrappedAges = () =>
  [...document.querySelectorAll('[data-inbox-key] time')].flatMap((time) => {
    const lineHeight = parseFloat(getComputedStyle(time).lineHeight);
    return time.getBoundingClientRect().height > lineHeight * 1.5
      ? [
          {
            key: time.closest('[data-inbox-key]')?.dataset.inboxKey ?? null,
            text: time.textContent,
          },
        ]
      : [];
  });

const branchCellOverlaps = () =>
  [...document.querySelectorAll('[data-testid="project-mount-branch-cell"]')].flatMap((cell) => {
    const action = cell.nextElementSibling;
    if (!(action instanceof HTMLElement)) return [];
    const actionLeft = action.getBoundingClientRect().left;
    const reaching = [...cell.children].filter(
      (child) => child.getBoundingClientRect().right > actionLeft + 0.5,
    );
    return reaching.length > 0
      ? [{ row: cell.closest('li')?.getAttribute('aria-label') ?? null, count: reaching.length }]
      : [];
  });

const waitForRoot = async ({ budgetMs }) => {
  const start = performance.now();
  while (performance.now() - start < budgetMs) {
    if (
      document.readyState === 'complete' &&
      (document.getElementById('root')?.childElementCount ?? 0) > 0
    ) {
      return true;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  return false;
};

const warmUp = async ({ send }) => {
  await measureScene({
    scene: WARM_UP_SCENE,
    task: async () => {
      await send('Page.enable');
      await send(
        'Page.navigate',
        { url: `${app}/?scene=${WARM_UP_SCENE}&brand=1` },
        WARM_UP_TIMEOUT_MS,
      );
      const isRendered = await run(
        send,
        waitForRoot,
        { budgetMs: WARM_UP_POLL_BUDGET_MS },
        WARM_UP_TIMEOUT_MS,
      );
      if (isRendered !== true) {
        throw new Error(
          `scene ${WARM_UP_SCENE}: warm-up did not render in ${WARM_UP_TIMEOUT_MS / 1000}s`,
        );
      }
    },
  });
};

const measureActivity = async ({ send, scene }) => {
  const failures = [];
  for (const zoom of ZOOMS) {
    await open({ send, scene, width: WIDTHS[0], zoom });
    const motion = await run(send, openEveryGroup, {
      stillCap: STILL_CAP_PX,
      settleMs: SETTLE_MS,
      frameFallbackMs: FRAME_FALLBACK_MS,
    });
    if (motion.transformed.length > 0) {
      failures.push({ scene, zoom, check: 'row keeps a transform', rows: motion.transformed });
    }
    if (motion.moved.length > 0) {
      failures.push({ scene, zoom, check: 'group row moved', rows: motion.moved });
    }
    const seams = await run(send, railSeams, { tolerance: SEAM_TOLERANCE_PX });
    if (seams.length > 0) {
      failures.push({ scene, zoom, check: 'rail seam', seams });
    }
    console.log(
      `${scene} at ${Math.round(zoom * 100)}%: ${motion.groups} groups, ${seams.length} seams`,
    );
  }
  for (const width of WIDTHS) {
    await open({ send, scene, width, zoom: 1 });
    const gaps = await run(send, metaGaps, { cap: META_GAP_CAP_PX });
    if (gaps.length > 0) {
      failures.push({ scene, width, check: 'meta gap over the cap', gaps });
    }
    const clipped = await run(send, clippedTimes, null);
    if (clipped.length > 0) {
      failures.push({ scene, width, check: 'time wider than its column', clipped });
    }
  }
  return { failures, wraps: 0 };
};

const measureInbox = async ({ send, width }) => {
  const failures = [];
  await open({ send, scene: 'inbox', width, zoom: 1, readySelector: '[data-inbox-key]' });
  const wrapped = await run(send, wrappedAges, null);
  if (wrapped.length > 0) {
    failures.push({ scene: 'inbox', width, check: 'task age wraps', wrapped });
  }
  return { failures, wraps: wrapped.length };
};

const measureLongBranches = async ({ send, width }) => {
  const scene = 'overview-long-branches';
  const failures = [];
  await open({
    send,
    scene,
    width,
    zoom: 1,
    readySelector: '[data-testid="project-mount-branch-cell"]',
  });
  const overlaps = await run(send, branchCellOverlaps, null);
  if (overlaps.length > 0) {
    failures.push({
      scene,
      width,
      check: 'branch runs under the put on branch button',
      overlaps,
    });
  }
  return { failures, wraps: 0 };
};

const measurePlanDrawer = async ({ send, scene, until }) => {
  const failures = [];
  await open({
    send,
    scene,
    width: PLAN_DRAWER_WIDTH,
    zoom: 1,
    readySelector: '[data-testid="plan-drawer-toolbar"]',
  });
  const header = await run(send, planDrawerHeader, { until, tolerance: ROW_TOLERANCE_PX });
  const isBroken =
    header.missing ||
    header.rowSpread > ROW_TOLERANCE_PX ||
    header.overflow > 0 ||
    header.pastEdge.length > 0 ||
    header.titleLines > 2;
  if (isBroken) {
    failures.push({ scene, check: 'plan drawer header wraps or overflows', header });
  }
  console.log(
    `${scene}: card ${header.cardWidth}px, header row spread ${header.rowSpread}px, overflow ${header.overflow}px`,
  );
  return { failures, wraps: 0 };
};

const measureWorkflow = async ({ send, target }) => {
  const failures = [];
  const result = await validateWorkflowScroll({ send, ...target });
  if (!result.reached) {
    failures.push({ scene: target.scene, check: 'workflow bottom unreachable', result });
  }
  console.log(`${target.scene}: workflow bottom ${result.reached ? 'reached' : 'not reached'}`);
  return { failures, wraps: 0 };
};

const confirmLayoutProbe = async ({ settleMs, tolerance }) => {
  const pausePage = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
  const snapshot = () => ({
    height: document.documentElement.scrollHeight,
    slots: [...document.querySelectorAll('[data-slot]')]
      .filter((element) => element.closest('[data-dropdown-portal]') === null)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          name: element.dataset.slot,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      }),
  });
  const differences = ({ before, after }) => {
    if (Math.abs(before.height - after.height) > tolerance) return ['scroll height'];
    if (before.slots.length !== after.slots.length) return ['slot count'];
    return before.slots.flatMap((slot, index) => {
      const next = after.slots[index];
      const hasMoved = ['left', 'top', 'width', 'height'].some(
        (key) => Math.abs(slot[key] - next[key]) > tolerance,
      );
      return hasMoved ? [slot.name] : [];
    });
  };
  const results = [];
  for (const trigger of document.querySelectorAll('[data-confirm-trigger]')) {
    const before = snapshot();
    trigger.click();
    await pausePage(settleMs);
    const isArmed = document.querySelector('[data-dropdown-portal] [role="dialog"]') !== null;
    const after = snapshot();
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
    await pausePage(settleMs);
    results.push({
      trigger: trigger.getAttribute('aria-label') ?? (trigger.textContent ?? '').trim(),
      isArmed,
      changed: differences({ before, after }),
    });
  }
  return results;
};

const measureConfirmPopover = async ({ send, variant }) => {
  const scene = `confirmpopover&v=${variant}`;
  const failures = [];
  await open({ send, scene, width: WIDTHS[0], zoom: 1, readySelector: '[data-confirm-trigger]' });
  const results = await run(send, confirmLayoutProbe, {
    settleMs: ARM_SETTLE_MS,
    tolerance: LAYOUT_TOLERANCE_PX,
  });
  const broken = results.filter((result) => !result.isArmed || result.changed.length > 0);
  if (results.length === 0 || broken.length > 0) {
    failures.push({
      scene,
      check: 'arming a confirm moves the page or opens no popover',
      triggers: results.length,
      broken,
    });
  }
  console.log(`${scene}: ${results.length} confirms armed, ${broken.length} moved the page`);
  return { failures, wraps: 0 };
};

const measureMenuRows = async ({ send, scene }) => {
  const startedAt = Date.now();
  await open({
    send,
    scene,
    width: WIDTHS[0],
    zoom: 1,
    readySelector: 'body',
    settleMs: MENU_SCENE_SETTLE_MS,
  });
  const probe = await run(send, menuRowsProbe, MENU_PROBE_PARAMS);
  console.log(
    `${scene}: ${probe.tested} of ${probe.total} menu triggers opened in ${Date.now() - startedAt}ms`,
  );
  return { failures: menuRowsFailures({ scene, probe }), wraps: 0 };
};

const sceneIds = () =>
  readFileSync(SCENE_LIST, 'utf8')
    .split('\n')
    .filter((id) => id !== '');

const menuScenes = ({ only: filter }) => {
  const ids = sceneIds();
  if (filter === undefined || filter === 'menus') return ids;
  const wanted = filter.split(',');
  return ids.filter((id) => wanted.includes(id));
};

const main = async () => {
  const failures = [];
  let crash = null;
  const session = await browser();
  const { send } = session;
  const measure = async ({ scene, task }) => {
    const outcome = await measureScene({ scene, task });
    failures.push(...outcome.failures);
    return outcome;
  };
  try {
    await warmUp({ send });
    for (const scene of only === undefined ? ['activity-run', 'activity-resolves'] : []) {
      await measure({ scene, task: () => measureActivity({ send, scene }) });
    }
    for (const width of only === undefined ? WIDTHS : []) {
      const inbox = await measure({
        scene: 'inbox',
        task: () => measureInbox({ send, width }),
      });
      await measure({
        scene: 'overview-long-branches',
        task: () => measureLongBranches({ send, width }),
      });
      console.log(`inbox and overview-long-branches at ${width}: ${inbox.wraps} wraps`);
    }
    for (const { scene, until } of only === undefined || only === 'plan-drawer'
      ? PLAN_DRAWER_SCENES
      : []) {
      await measure({ scene, task: () => measurePlanDrawer({ send, scene, until }) });
    }
    for (const target of only === undefined || only === 'workflow'
      ? [
          { scene: 'workflow-studio&view=rules', click: null },
          { scene: 'frame&view=workflows', click: 'Run defaults' },
        ]
      : []) {
      await measure({ scene: target.scene, task: () => measureWorkflow({ send, target }) });
    }
    for (const variant of only === undefined || only === 'confirm' ? CONFIRM_VARIANTS : []) {
      await measure({
        scene: `confirmpopover&v=${variant}`,
        task: () => measureConfirmPopover({ send, variant }),
      });
    }
    for (const scene of menuScenes({ only })) {
      await measure({ scene, task: () => measureMenuRows({ send, scene }) });
    }
  } catch (error) {
    crash = error;
  } finally {
    await session.close();
  }
  console.log(summaryLine({ scenes: failingScenes({ failures, error: crash }) }));
  if (failures.length > 0) {
    console.error(JSON.stringify(failures, null, 2));
    console.error(`validate-scenes failed: ${failures.length} checks`);
    for (const line of failureLines({ failures })) {
      console.error(line);
    }
  }
  if (crash !== null) throw crash;
  if (failures.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log('validate-scenes ok');
};

main().catch((error) => {
  console.error(`validate-scenes: ${error.message}`);
  process.exitCode = 1;
});
