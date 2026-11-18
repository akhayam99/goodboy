import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromePathOf, DEFAULT_SHOT_URL } from './lib/figures.mjs';

const USAGE = `usage: node scripts/demo-walk.mjs --out-dir <folder>
  [--window 1440x900] [--theme dark|light] [--only fix-start,fix-push]
  [--base http://localhost:5230]`;

const CHAPTERS_MODULE = '/src/app/components/MockScene/demo/demoChapters.ts';
const COACH_WAIT_MS = 25_000;
const RESULT_WAIT_MS = 30_000;
const ADVANCE_WAIT_MS = 10_000;
const EVALUATE_WAIT_MS = 15_000;
const LOAD_ATTEMPTS = 4;
const WALK_LIMIT_MS = 8 * 60 * 1000;

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, '');
    if (!key || argv[index + 1] === undefined) {
      throw new Error(USAGE);
    }
    args[key] = argv[index + 1];
  }
  if (!args['out-dir']) {
    throw new Error(USAGE);
  }
  const [width, height] = (args.window ?? '1440x900').split('x').map(Number);
  const theme = args.theme ?? 'dark';
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error(USAGE);
  }
  return {
    outDir: resolve(args['out-dir']),
    width,
    height,
    theme,
    only: args.only ? new Set(args.only.split(',')) : null,
    base: args.base ?? process.env.GOODBOY_SHOT_URL ?? DEFAULT_SHOT_URL,
  };
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const connect = async ({ port }) => {
  let targets = null;
  for (let attempt = 0; attempt < 60 && !targets; attempt += 1) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    } catch {
      await sleep(200);
    }
  }
  const page = targets?.find((target) => target.type === 'page');
  if (!page) {
    throw new Error('no page target');
  }
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.addEventListener('open', done);
    socket.addEventListener('error', () => fail(new Error('devtools socket did not open')));
  });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      errors.push((details.exception?.description ?? details.text).slice(0, 300));
    }
  });
  const send = (method, params = {}) =>
    new Promise((done) => {
      sequence += 1;
      pending.set(sequence, done);
      socket.send(JSON.stringify({ id: sequence, method, params }));
    });
  return { send, errors, close: () => socket.close() };
};

const openChrome = async ({ width, height }) => {
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'demo-walk-'));
  const chrome = spawn(
    chromePathOf(),
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const close = () => {
    try {
      chrome.kill('SIGKILL');
    } catch {}
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  };
  try {
    const session = await connect({ port });
    return { ...session, close: () => [session.close(), close()] };
  } catch (error) {
    close();
    throw error;
  }
};

const stateSource = `(() => {
  const rectOf = (box) => box === null ? null : { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
  const coach = document.querySelector('[data-testid=demo-coach-mark]');
  const ring = coach === null ? null : coach.querySelector('div.ring-2');
  const callout = coach === null ? null : coach.querySelector('[role=note][aria-label=Hint]');
  const frame = [...document.querySelectorAll('iframe')].find((item) => item.dataset.shown === 'true' && item.title === 'Goodboy app') ?? null;
  const frameBox = frame === null ? null : frame.getBoundingClientRect();
  const scale = frame === null || frame.offsetWidth === 0 ? 1 : frameBox.width / frame.offsetWidth;
  const chrome = frame === null || frame.contentDocument === null ? [] : [...frame.contentDocument.querySelectorAll('[data-shell-rail], [data-tool-rail]')].map((element) => {
    const box = element.getBoundingClientRect();
    return rectOf({ x: frameBox.x + box.x * scale, y: frameBox.y + box.y * scale, width: box.width * scale, height: box.height * scale });
  });
  return {
    hash: location.hash,
    header: document.querySelector('[data-testid=demo-instruction]')?.textContent ?? null,
    coachCopy: callout?.querySelector('p')?.textContent ?? null,
    side: callout?.dataset.side ?? null,
    ring: ring === null ? null : rectOf(ring.getBoundingClientRect()),
    callout: callout === null ? null : rectOf(callout.getBoundingClientRect()),
    chrome,
    slot: document.querySelector('[data-testid=demo-hint-slot]')?.textContent ?? null,
    frame: frame === null ? null : { src: frame.getAttribute('src'), rect: rectOf(frameBox) },
  };
})()`;

const targetSource = ({ x, y }) => `(() => {
  const frame = [...document.querySelectorAll('iframe')].find((item) => item.dataset.shown === 'true' && item.title === 'Goodboy app');
  if (frame === undefined) {
    return null;
  }
  const box = frame.getBoundingClientRect();
  const scale = box.width / frame.offsetWidth;
  const element = frame.contentDocument.elementFromPoint((${x} - box.x) / scale, (${y} - box.y) / scale);
  if (element === null) {
    return null;
  }
  const control = element.closest('button, a, [role=radio], [role=button], input, textarea, [role=menuitem], [role=tab]') ?? element;
  return {
    tag: control.tagName.toLowerCase(),
    label: control.getAttribute('aria-label') ?? control.textContent.trim().replace(/\\s+/g, ' ').slice(0, 80),
    anchor: control.closest('[data-demo-anchor]')?.dataset.demoAnchor ?? null,
  };
})()`;

const showControlSource = `(() => {
  const button = [...document.querySelectorAll('[data-testid=demo-hint-slot] button')].find((item) => item.textContent.includes('Show control'));
  if (button === undefined) {
    return null;
  }
  const box = button.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
})()`;

const isMeeting = ({ left, right }) =>
  left.x < right.x + right.w &&
  left.x + left.w > right.x &&
  left.y < right.y + right.h &&
  left.y + left.h > right.y;

const createPage = ({ send }) => {
  const evaluate = async ({ expression }) => {
    const response = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      sleep(EVALUATE_WAIT_MS).then(() => null),
    ]);
    if (response === null || response.result?.exceptionDetails) {
      return null;
    }
    return response.result?.result?.value ?? null;
  };
  const click = async ({ x, y }) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await sleep(120);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  };
  const waitFor = async ({ isDone, ms }) => {
    const start = Date.now();
    let state = null;
    while (Date.now() - start < ms) {
      state = await evaluate({ expression: stateSource });
      if (state !== null && isDone({ state })) {
        return { state, ms: Date.now() - start };
      }
      await sleep(100);
    }
    return { state, ms: -1 };
  };
  return { evaluate, click, waitFor };
};

const walkStep = async ({ page, chapter, hint, index, shoot }) => {
  const entry = { group: chapter.title, id: hint.id, copy: hint.copy };
  let shown = await page.waitFor({
    isDone: ({ state }) =>
      state.coachCopy === hint.copy && state.ring !== null && state.callout !== null,
    ms: COACH_WAIT_MS,
  });
  if (shown.ms < 0 && shown.state?.slot) {
    const slot = await page.evaluate({ expression: showControlSource });
    if (slot !== null) {
      await page.click(slot);
    }
    shown = await page.waitFor({
      isDone: ({ state }) => state.coachCopy === hint.copy && state.ring !== null,
      ms: ADVANCE_WAIT_MS,
    });
  }
  entry.coachMs = shown.ms;
  entry.state = shown.state;
  if (shown.ms < 0) {
    await shoot({ kind: 'coach' });
    return { ...entry, problem: 'coach never showed' };
  }
  await sleep(500);
  const { ring, callout, chrome } = shown.state;
  const center = { x: ring.x + ring.w / 2, y: ring.y + ring.h / 2 };
  entry.target = await page.evaluate({ expression: targetSource(center) });
  entry.calloutCoversTarget = isMeeting({ left: callout, right: ring });
  entry.calloutCoversChrome = chrome.some(
    (rect) => !isMeeting({ left: rect, right: ring }) && isMeeting({ left: callout, right: rect }),
  );
  await shoot({ kind: 'coach' });
  await page.click(center);
  const isLast = index === chapter.hints.length - 1;
  const result = hint.result.replace(/\*\*/g, '');
  const done = await page.waitFor({
    isDone: ({ state }) => state.header === result || (isLast && state.hash !== `#${chapter.id}`),
    ms: RESULT_WAIT_MS,
  });
  entry.resultMs = done.ms;
  entry.headerAfter = done.state?.header ?? null;
  await sleep(300);
  await shoot({ kind: 'result' });
  if (isLast) {
    const moved = await page.waitFor({
      isDone: ({ state }) => state.hash !== `#${chapter.id}`,
      ms: ADVANCE_WAIT_MS,
    });
    entry.advancedTo = moved.state?.hash ?? null;
  }
  if (done.ms < 0) {
    return { ...entry, problem: `result never showed; header: ${entry.headerAfter}` };
  }
  if (entry.calloutCoversTarget || entry.calloutCoversChrome) {
    return { ...entry, problem: 'callout covers its target or the app chrome' };
  }
  return entry;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const { outDir, width, height, theme, only, base } = options;
  mkdirSync(outDir, { recursive: true });
  const tag = `${width}x${height}-${theme}`;
  const chrome = await openChrome({ width, height });
  const limit = setTimeout(() => {
    console.log('walk timed out');
    chrome.close();
    process.exit(3);
  }, WALK_LIMIT_MS);
  limit.unref();
  const { send, errors } = chrome;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const page = createPage({ send });
  let chapters = null;
  for (let attempt = 0; attempt < LOAD_ATTEMPTS && !Array.isArray(chapters); attempt += 1) {
    await send('Page.navigate', { url: `${base}/?scene=demo&theme=${theme}` });
    await sleep(4000);
    chapters = await page.evaluate({
      expression: `import('${CHAPTERS_MODULE}').then((module) => module.DEMO_CHAPTERS.map((chapter) => ({ id: chapter.id, title: chapter.title, hints: chapter.hints.map((hint) => ({ id: hint.id, copy: hint.copy, result: hint.result })) })))`,
    });
  }
  if (!Array.isArray(chapters)) {
    chrome.close();
    throw new Error(`no demo chapters at ${base}; start the mock dev server first`);
  }
  const log = [];
  const save = ({ closing = null }) =>
    writeFileSync(
      join(outDir, `walk-${tag}.json`),
      JSON.stringify({ log, closing, errors }, null, 2),
    );
  let step = 0;
  for (const chapter of chapters) {
    for (const [index, hint] of chapter.hints.entries()) {
      step += 1;
      const number = String(step).padStart(2, '0');
      const shoot = async ({ kind }) => {
        if (only !== null && !only.has(hint.id)) {
          return;
        }
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(
          join(outDir, `${number}-${hint.id}-${kind}-${tag}.png`),
          Buffer.from(shot.result.data, 'base64'),
        );
      };
      const entry = { n: step, ...(await walkStep({ page, chapter, hint, index, shoot })) };
      log.push(entry);
      save({});
      console.log(
        `${number} ${hint.id} ${entry.problem === undefined ? 'ok' : `failed: ${entry.problem}`}`,
      );
      if (entry.coachMs < 0) {
        chrome.close();
        process.exit(1);
      }
    }
  }
  await sleep(1500);
  const closing = await page.evaluate({ expression: stateSource });
  if (only === null) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `99-closing-${tag}.png`), Buffer.from(shot.result.data, 'base64'));
  }
  save({ closing });
  const failed = log.filter((entry) => entry.problem !== undefined);
  console.log(`walk ${tag}: ${log.length - failed.length} of ${log.length} steps ok`);
  chrome.close();
  process.exit(failed.length === 0 ? 0 : 1);
};

await main();
