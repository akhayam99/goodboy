import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEV_URL = 'http://localhost:1421';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WINDOW_METRICS = { width: 1360, height: 850, deviceScaleFactor: 1, mobile: false };
const SHOT_METRICS = { width: 680, height: 425, deviceScaleFactor: 2, mobile: false };
const RENDER_WAIT_MS = 4000;
const RELAYOUT_WAIT_MS = 1000;
const THEMES = ['dark', 'light'];
const OUT_DIRECTORY = resolve(ROOT_DIRECTORY, 'docs/changelog/next');

const usageAndExit = () => {
  console.error('usage: changelog-shots.mjs <scene> <name> <before|after>');
  process.exitCode = 1;
  process.exit(1);
};

const [, , scene, name, variant] = process.argv;
if (scene === undefined || name === undefined) {
  usageAndExit();
}
if (variant !== 'before' && variant !== 'after') {
  usageAndExit();
}

const sleep = ({ ms }) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const waitForTarget = async ({ port }) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page !== undefined) {
        return page;
      }
    } catch {}
    await sleep({ ms: 200 });
  }
  throw new Error('headless chrome never exposed a page target');
};

const openCdpClient = async ({ port }) => {
  const page = await waitForTarget({ port });
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen) => socket.addEventListener('open', resolveOpen));
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined || !pending.has(message.id)) {
      return;
    }
    pending.get(message.id)(message);
    pending.delete(message.id);
  });
  const send = ({ method, params = {} }) =>
    new Promise((resolveSend) => {
      const id = (nextId += 1);
      pending.set(id, resolveSend);
      socket.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => socket.close() };
};

const contentBox = ({ quad }) => {
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

const captureThemePng = async ({ theme }) => {
  const port = 9400 + Math.floor(Math.random() * 500);
  const profileDir = mkdtempSync(join(tmpdir(), 'goodboy-changelog-shot-'));
  const proc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--window-size=1024,768',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  try {
    const { send } = await openCdpClient({ port });
    await send({ method: 'Emulation.setDeviceMetricsOverride', params: WINDOW_METRICS });
    await send({ method: 'Page.enable' });
    await send({
      method: 'Page.navigate',
      params: { url: `${DEV_URL}/?scene=${scene}&theme=${theme}` },
    });
    await sleep({ ms: RENDER_WAIT_MS });

    const documentResult = await send({ method: 'DOM.getDocument', params: { depth: -1 } });
    const rootNodeId = documentResult.result?.root?.nodeId;
    if (rootNodeId === undefined) {
      throw new Error('could not read the document of the mock scene');
    }
    const queryResult = await send({
      method: 'DOM.querySelector',
      params: { nodeId: rootNodeId, selector: '[data-shot]' },
    });
    const nodeId = queryResult.result?.nodeId;
    if (nodeId === undefined || nodeId === 0) {
      const windowShot = await send({ method: 'Page.captureScreenshot', params: { format: 'png' } });
      if (windowShot.result?.data === undefined) {
        throw new Error(`could not capture scene "${scene}"`);
      }
      return Buffer.from(windowShot.result.data, 'base64');
    }
    await send({ method: 'Emulation.setDeviceMetricsOverride', params: SHOT_METRICS });
    await sleep({ ms: RELAYOUT_WAIT_MS });
    const boxResult = await send({ method: 'DOM.getBoxModel', params: { nodeId } });
    const quad = boxResult.result?.model?.content;
    if (quad === undefined) {
      throw new Error(`could not read the box model of [data-shot] in scene "${scene}"`);
    }
    const clip = { ...contentBox({ quad }), scale: 1 };
    const shot = await send({
      method: 'Page.captureScreenshot',
      params: { format: 'png', clip },
    });
    if (shot.result?.data === undefined) {
      throw new Error(`could not capture scene "${scene}"`);
    }
    return Buffer.from(shot.result.data, 'base64');
  } finally {
    proc.kill('SIGKILL');
    rmSync(profileDir, { recursive: true, force: true });
  }
};

const main = async () => {
  mkdirSync(OUT_DIRECTORY, { recursive: true });
  for (const theme of THEMES) {
    const png = await captureThemePng({ theme });
    const pngPath = resolve(OUT_DIRECTORY, `${name}-${variant}-${theme}.png`);
    const webpPath = resolve(OUT_DIRECTORY, `${name}-${variant}-${theme}.webp`);
    writeFileSync(pngPath, png);
    execFileSync('cwebp', ['-quiet', '-q', '80', pngPath, '-o', webpPath]);
    rmSync(pngPath);
    console.log('ok', webpPath);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
