import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
const CALL_TIMEOUT_MS = 60_000;
const CLOSE_GRACE_MS = 5_000;
const FRAME_FALLBACK_MS = 100;
const CLICK_PATIENCE_MS = 8000;

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
  return (method, params = {}) =>
    new Promise((resolvePromise, reject) => {
      id += 1;
      const callId = id;
      const timer = setTimeout(() => {
        pending.delete(callId);
        reject(new Error(`Chrome DevTools call ${method} timed out`));
      }, CALL_TIMEOUT_MS);
      pending.set(callId, (message) => {
        clearTimeout(timer);
        resolvePromise(message);
      });
      socket.send(JSON.stringify({ id: callId, method, params }));
    });
};

const browser = async () => {
  const port = 9900 + Math.floor(Math.random() * 90);
  const profile = mkdtempSync(join(tmpdir(), 'validate-scenes-'));
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const exited = new Promise((resolvePromise) => {
    child.once('exit', resolvePromise);
  });
  const send = await connect(port);
  const close = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      const patience = new Promise((resolvePromise) => {
        setTimeout(() => resolvePromise(false), CLOSE_GRACE_MS).unref();
      });
      const stopped = await Promise.race([exited.then(() => true), patience]);
      if (!stopped) {
        child.kill('SIGKILL');
        await exited;
      }
    }
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      console.warn(`validate-scenes: could not remove ${profile}`);
    }
  };
  return { send, close };
};

const run = async (send, fn, argument) => {
  const result = await send('Runtime.evaluate', {
    expression: `(${fn.toString()})(${JSON.stringify(argument)})`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.result?.exceptionDetails) {
    throw new Error(JSON.stringify(result.result.exceptionDetails).slice(0, 400));
  }
  return result.result?.result?.value;
};

const attemptOpen = async ({ send, scene, readySelector }) => {
  try {
    await send('Page.navigate', { url: `${app}/?scene=${scene}&brand=1` });
    await pause(wait);
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
  } catch {
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
}) => {
  await send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(width / zoom),
    height: Math.round(height / zoom),
    deviceScaleFactor: 2 * zoom,
    mobile: false,
  });
  await send('Page.enable');
  for (let attempt = 0; attempt < OPEN_ATTEMPTS; attempt += 1) {
    const isReady = await attemptOpen({ send, scene, readySelector });
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

const main = async () => {
  const failures = [];
  const session = await browser();
  try {
    for (const scene of only === undefined ? ['activity-run', 'activity-resolves'] : []) {
      for (const zoom of ZOOMS) {
        await open({ send: session.send, scene, width: WIDTHS[0], zoom });
        const motion = await run(session.send, openEveryGroup, {
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
        const seams = await run(session.send, railSeams, { tolerance: SEAM_TOLERANCE_PX });
        if (seams.length > 0) {
          failures.push({ scene, zoom, check: 'rail seam', seams });
        }
        console.log(
          `${scene} at ${Math.round(zoom * 100)}%: ${motion.groups} groups, ${seams.length} seams`,
        );
      }
      for (const width of WIDTHS) {
        await open({ send: session.send, scene, width, zoom: 1 });
        const gaps = await run(session.send, metaGaps, { cap: META_GAP_CAP_PX });
        if (gaps.length > 0) {
          failures.push({ scene, width, check: 'meta gap over the cap', gaps });
        }
        const clipped = await run(session.send, clippedTimes, null);
        if (clipped.length > 0) {
          failures.push({ scene, width, check: 'time wider than its column', clipped });
        }
      }
    }
    for (const width of only === undefined ? WIDTHS : []) {
      await open({
        send: session.send,
        scene: 'inbox',
        width,
        zoom: 1,
        readySelector: '[data-inbox-key]',
      });
      const wrapped = await run(session.send, wrappedAges, null);
      if (wrapped.length > 0) {
        failures.push({ scene: 'inbox', width, check: 'task age wraps', wrapped });
      }
      await open({
        send: session.send,
        scene: 'overview-long-branches',
        width,
        zoom: 1,
        readySelector: '[data-testid="project-mount-branch-cell"]',
      });
      const overlaps = await run(session.send, branchCellOverlaps, null);
      if (overlaps.length > 0) {
        failures.push({
          scene: 'overview-long-branches',
          width,
          check: 'branch runs under the put on branch button',
          overlaps,
        });
      }
      console.log(`inbox and overview-long-branches at ${width}: ${wrapped.length} wraps`);
    }
    for (const { scene, until } of only === undefined || only === 'plan-drawer'
      ? PLAN_DRAWER_SCENES
      : []) {
      await open({
        send: session.send,
        scene,
        width: PLAN_DRAWER_WIDTH,
        zoom: 1,
        readySelector: '[data-testid="plan-drawer-toolbar"]',
      });
      const header = await run(session.send, planDrawerHeader, {
        until,
        tolerance: ROW_TOLERANCE_PX,
      });
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
    }
    for (const target of only === undefined || only === 'workflow'
      ? [
          { scene: 'workflow-studio&view=rules', click: null },
          { scene: 'frame&view=workflows', click: 'Run defaults' },
        ]
      : []) {
      const result = await validateWorkflowScroll({ send: session.send, ...target });
      if (!result.reached) {
        failures.push({ scene: target.scene, check: 'workflow bottom unreachable', result });
      }
      console.log(`${target.scene}: workflow bottom ${result.reached ? 'reached' : 'not reached'}`);
    }
  } finally {
    await session.close();
  }
  if (failures.length > 0) {
    console.error(JSON.stringify(failures, null, 2));
    console.error(`validate-scenes failed: ${failures.length} checks`);
    process.exitCode = 1;
    return;
  }
  console.log('validate-scenes ok');
};

main().catch((error) => {
  console.error(`validate-scenes: ${error.message}`);
  process.exitCode = 1;
});
