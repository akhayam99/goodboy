import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIRECTORY = resolve(
  process.env.GOODBOY_MEDIA_DIR ?? resolve(ROOT_DIRECTORY, '..', 'goodboy-media'),
  'features',
);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const THEMES = ['dark', 'light'];

const STAGE = {
  dark: {
    gradient: 'linear-gradient(160deg, #173239 0%, #101b1f 46%, #0b0e11 100%)',
    line: 'rgb(255 255 255 / 0.06)',
    edge: 'rgb(255 255 255 / 0.1)',
  },
  light: {
    gradient: 'linear-gradient(160deg, #dde7e9 0%, #e8eef0 46%, #f1f4f6 100%)',
    line: 'rgb(16 17 19 / 0.06)',
    edge: 'rgb(16 17 19 / 0.1)',
  },
};

const USAGE = `usage: node scripts/feature-shots.mjs --scene <key&params> --out <name>
  [--selector <css>] [--clip x,y,w,h] [--window 1280x800] [--pad 24]
  [--scale 3] [--wait 5000] [--frame-pad 40] [--themes dark,light]
  [--base http://localhost:5230]
       node scripts/feature-shots.mjs --scene <key&params> --probe <css> [--window 1280x800]`;

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, '');
    if (!key || argv[index + 1] === undefined) {
      throw new Error(USAGE);
    }
    args[key] = argv[index + 1];
  }
  if (!args.scene || (!args.out && !args.probe)) {
    throw new Error(USAGE);
  }
  const [width, height] = (args.window ?? '1280x800').split('x').map(Number);
  return {
    scene: args.scene,
    out: args.out,
    selector: args.selector ?? null,
    probe: args.probe ?? null,
    clip: args.clip ? args.clip.split(',').map(Number) : null,
    width,
    height,
    pad: Number(args.pad ?? 24),
    scale: Number(args.scale ?? 3),
    wait: Number(args.wait ?? 5000),
    framePad: Number(args['frame-pad'] ?? 40),
    themes: (args.themes ?? THEMES.join(',')).split(','),
    base: args.base ?? process.env.GOODBOY_SHOT_URL ?? 'http://localhost:5230',
  };
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const openChrome = async ({ width, height }) => {
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'feature-shots-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-site-isolation-trials',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
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
  await new Promise((done) => socket.addEventListener('open', done));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((done) => {
      sequence += 1;
      pending.set(sequence, done);
      socket.send(JSON.stringify({ id: sequence, method, params }));
    });
  const close = () => {
    try {
      chrome.kill('SIGKILL');
    } catch {}
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, close };
};

const evaluate = async ({ send, expression }) => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true });
  return response.result?.result?.value;
};

const captureScene = async ({ send, options, theme }) => {
  await send('Emulation.setDeviceMetricsOverride', {
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.enable');
  const url = `${options.base}/?scene=${options.scene}&theme=${theme}`;
  await send('Page.navigate', { url });
  await sleep(options.wait);
  let box;
  if (options.selector) {
    box = await evaluate({
      send,
      expression: `(() => { const el = document.querySelector(${JSON.stringify(options.selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`,
    });
    if (!box) {
      throw new Error(`selector ${options.selector} not found in ${url}`);
    }
    const [x, y, w, h] = box;
    const left = Math.max(0, x - options.pad);
    const top = Math.max(0, y - options.pad);
    const right = Math.min(options.width, x + w + options.pad);
    const bottom = Math.min(options.height, y + h + options.pad);
    box = [left, top, right - left, bottom - top];
  } else {
    box = options.clip ?? [0, 0, options.width, options.height];
  }
  const [x, y, w, h] = box.map(Math.round);
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x, y, width: w, height: h, scale: options.scale },
  });
  if (!shot.result?.data) {
    throw new Error(`capture failed ${JSON.stringify(shot.error ?? {})}`);
  }
  return { png: shot.result.data, width: w, height: h };
};

const probeScene = async ({ send, options }) => {
  await send('Emulation.setDeviceMetricsOverride', {
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.enable');
  await send('Page.navigate', { url: `${options.base}/?scene=${options.scene}&theme=dark` });
  await sleep(options.wait);
  const rows = await evaluate({
    send,
    expression: `[...document.querySelectorAll(${JSON.stringify(options.probe)})].slice(0, 40).map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(',') + '  ' + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') + '  ' + (el.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 70); })`,
  });
  console.log((rows ?? []).join('\n') || 'no match');
};

const frameHtml = ({ png, width, height, framePad, theme }) => {
  const stage = STAGE[theme];
  return `<!doctype html><html><head><style>
html,body{margin:0;background:transparent}
.stage{display:inline-block;padding:${framePad}px;border-radius:28px;background:${stage.gradient};box-shadow:inset 0 0 0 1px ${stage.line}}
.view{display:block;width:${width}px;height:${height}px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px ${stage.edge}}
.view img{display:block;width:${width}px;height:${height}px}
</style></head><body><div class="stage"><div class="view"><img src="data:image/png;base64,${png}"></div></div></body></html>`;
};

const composeFrame = async ({ send, capture, options, theme, workDirectory }) => {
  const frameWidth = capture.width + options.framePad * 2;
  const frameHeight = capture.height + options.framePad * 2;
  const htmlPath = join(workDirectory, `${theme}.html`);
  writeFileSync(htmlPath, frameHtml({ ...capture, framePad: options.framePad, theme }));
  await send('Emulation.setDeviceMetricsOverride', {
    width: frameWidth,
    height: frameHeight,
    deviceScaleFactor: options.scale,
    mobile: false,
  });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send('Page.navigate', { url: `file://${htmlPath}` });
  await sleep(800);
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: frameWidth, height: frameHeight, scale: 1 },
  });
  await send('Emulation.setDefaultBackgroundColorOverride', {});
  if (!shot.result?.data) {
    throw new Error(`frame failed ${JSON.stringify(shot.error ?? {})}`);
  }
  const pngPath = join(workDirectory, `${theme}.png`);
  writeFileSync(pngPath, Buffer.from(shot.result.data, 'base64'));
  const outPath = join(OUT_DIRECTORY, `${options.out}-${theme}.webp`);
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '86',
    '-alpha_q',
    '100',
    '-m',
    '6',
    pngPath,
    '-o',
    outPath,
  ]);
  return {
    outPath,
    pixels: `${frameWidth * options.scale}x${frameHeight * options.scale}`,
    frameWidth,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const workDirectory = mkdtempSync(join(tmpdir(), 'feature-frame-'));
  const chrome = await openChrome({ width: options.width, height: options.height });
  const timer = setTimeout(() => {
    console.error('feature-shots: timeout');
    chrome.close();
    process.exit(1);
  }, 120000);
  try {
    if (options.probe) {
      await probeScene({ send: chrome.send, options });
      return;
    }
    for (const theme of options.themes) {
      const capture = await captureScene({ send: chrome.send, options, theme });
      const { outPath, pixels, frameWidth } = await composeFrame({
        send: chrome.send,
        capture,
        options,
        theme,
        workDirectory,
      });
      const kilobytes = Math.round(statSync(outPath).size / 1024);
      console.log(
        `shot ok: ${outPath} ${pixels} ${kilobytes} KB (clip ${capture.width}x${capture.height} css, frame ${frameWidth} css wide)`,
      );
    }
  } finally {
    clearTimeout(timer);
    chrome.close();
    rmSync(workDirectory, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(`feature-shots: ${error.message}`);
  process.exit(1);
});
