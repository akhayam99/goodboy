import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ZOOMS = [1, 1.1];
const WIDTHS = [1440, 1200, 1024, 880, 760];
const HEIGHT = 1000;
const STILL_CAP_PX = 1;
const SEAM_TOLERANCE_PX = 0.05;
const META_GAP_CAP_PX = 80;
const SETTLE_MS = 500;

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((value, index, values) => [value.replace(/^--/, ''), values[index + 1]])
    .filter(([key]) => key),
);
const app = args.app ?? 'http://localhost:5230';
const wait = Number(args.wait ?? 2500);

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
    new Promise((resolvePromise) => {
      id += 1;
      pending.set(id, resolvePromise);
      socket.send(JSON.stringify({ id, method, params }));
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
  const send = await connect(port);
  const close = () => {
    child.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
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

const open = async ({ send, scene, width, zoom }) => {
  await send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(width / zoom),
    height: Math.round(HEIGHT / zoom),
    deviceScaleFactor: 2 * zoom,
    mobile: false,
  });
  await send('Page.enable');
  await send('Page.navigate', { url: `${app}/?scene=${scene}&brand=1` });
  await pause(wait);
  await run(
    send,
    async () => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (document.querySelectorAll('[data-row-id]').length > 0) return true;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      }
      return false;
    },
    null,
  );
};

const openEveryGroup = async ({ stillCap, settleMs }) => {
  const frame = () => new Promise((resolvePromise) => requestAnimationFrame(resolvePromise));
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

const main = async () => {
  const failures = [];
  const session = await browser();
  try {
    for (const scene of ['activity-run', 'activity-resolves']) {
      for (const zoom of ZOOMS) {
        await open({ send: session.send, scene, width: WIDTHS[0], zoom });
        const motion = await run(session.send, openEveryGroup, {
          stillCap: STILL_CAP_PX,
          settleMs: SETTLE_MS,
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
      }
    }
  } finally {
    session.close();
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
