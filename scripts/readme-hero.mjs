import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appVersionOf, chromePathOf, DEFAULT_SHOT_URL, recordFigure } from './lib/figures.mjs';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIRECTORY = resolve(ROOT_DIRECTORY, 'docs/readme');
const SITE_DIRECTORY = resolve(ROOT_DIRECTORY, 'website/public/hero');

const THEMES = ['dark', 'light'];
const WIDTH = 1920;
const HEIGHT = 1200;
const README_WIDTH = 1460;
const README_HEIGHT = 900;
const README_CLIP = { x: 499, y: 38, width: 905, height: 636 };
const README_FROZEN_AT = Date.parse('2026-11-05T16:00:00');
const frozenClockSource = ({ at }) =>
  `(()=>{const F=${at};const D=Date;class X extends D{constructor(...a){a.length===0?super(F):super(...a)}static now(){return F}}window.Date=X})()`;
const SCALE = 4;
const SETTLE_MS = 12000;
const SITE_WIDTH = 1208;
const SITE_CROP_HEIGHT = 840;
const SITE_DENSITIES = [1, 2, 3];
const SCENE = 'readme-hero&brand=1';
const README_SCENE = 'readme-hero-log&brand=1';
const APP = process.argv[2]?.startsWith('http') === true ? process.argv[2] : DEFAULT_SHOT_URL;
const VERSION_ARGUMENT = process.argv.indexOf('--version');

const pause = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const connect = async ({ port }) => {
  let targets = [];
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      break;
    } catch {
      await pause(100);
    }
  }
  const target = targets.find((item) => item.type === 'page');
  if (target === undefined) {
    throw new Error(`Chrome did not open on ${port}`);
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise);
    socket.addEventListener('error', () => reject(new Error('Chrome DevTools connection failed')));
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
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

const openBrowser = async () => {
  const port = 9300 + Math.floor(Math.random() * 300);
  const profile = mkdtempSync(join(tmpdir(), 'readme-hero-'));
  const chrome = spawn(
    chromePathOf(),
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const close = () => {
    chrome.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  };
  try {
    const send = await connect({ port });
    return { send, close };
  } catch (error) {
    close();
    throw error;
  }
};

const webp = ({ input, output, width, cropHeight }) => {
  const crop =
    cropHeight === undefined
      ? []
      : ['-crop', '0', '0', String(WIDTH * SCALE), String(cropHeight * SCALE)];
  const resize = width === undefined ? [] : ['-resize', String(width), '0'];
  execFileSync('cwebp', ['-quiet', '-q', '82', '-m', '6', ...crop, ...resize, input, '-o', output]);
};

const capture = async ({ theme, workDirectory, scene, width, height, clip, name, frozenAt }) => {
  const { send, close } = await openBrowser();
  try {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: SCALE,
      mobile: false,
    });
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'prefers-color-scheme', value: theme },
      ],
    });
    await send('Page.enable');
    if (frozenAt !== undefined) {
      await send('Page.addScriptToEvaluateOnNewDocument', {
        source: frozenClockSource({ at: frozenAt }),
      });
    }
    await send('Page.navigate', { url: `${APP}/?scene=${scene}&theme=${theme}` });
    await pause(SETTLE_MS);
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      ...(clip === undefined ? {} : { clip: { ...clip, scale: 1 } }),
    });
    if (!shot.result?.data) {
      throw new Error(`capture failed ${JSON.stringify(shot.error ?? {})}`);
    }
    const pngPath = join(workDirectory, `${name}-${theme}.png`);
    writeFileSync(pngPath, Buffer.from(shot.result.data, 'base64'));
    return pngPath;
  } finally {
    close();
  }
};

const shoot = async ({ theme, workDirectory }) => {
  const readmePng = await capture({
    theme,
    workDirectory,
    scene: README_SCENE,
    width: README_WIDTH,
    height: README_HEIGHT,
    clip: README_CLIP,
    name: 'readme',
    frozenAt: README_FROZEN_AT,
  });
  const outPath = join(OUT_DIRECTORY, `readme-hero-${theme}.webp`);
  webp({ input: readmePng, output: outPath });
  const pngPath = await capture({
    theme,
    workDirectory,
    scene: SCENE,
    width: WIDTH,
    height: HEIGHT,
    name: 'site',
  });
  mkdirSync(SITE_DIRECTORY, { recursive: true });
  const sitePaths = SITE_DENSITIES.map((density) => {
    const width = SITE_WIDTH * density;
    const output = join(SITE_DIRECTORY, `hero-${theme}-${width}.webp`);
    webp({ input: pngPath, output, width, cropHeight: SITE_CROP_HEIGHT });
    return output;
  });
  return {
    outPath,
    sitePaths,
    pixels: `${README_CLIP.width * SCALE}x${README_CLIP.height * SCALE}`,
  };
};

const workDirectory = mkdtempSync(join(tmpdir(), 'readme-hero-png-'));
try {
  for (const theme of THEMES) {
    const { outPath, sitePaths, pixels } = await shoot({ theme, workDirectory });
    console.log(`wrote ${outPath} (${pixels})`);
    sitePaths.forEach((path) => console.log(`wrote ${path}`));
  }
  const version = appVersionOf({
    override: VERSION_ARGUMENT === -1 ? undefined : process.argv[VERSION_ARGUMENT + 1],
  });
  recordFigure({ key: 'readme/readme-hero', version, recipe: 'pnpm readme:hero' });
  console.log(`figures.json: readme/readme-hero is Goodboy ${version}`);
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
}
