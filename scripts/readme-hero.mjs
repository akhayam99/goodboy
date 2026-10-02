import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIRECTORY = resolve(ROOT_DIRECTORY, 'docs/readme');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const THEMES = ['dark', 'light'];
const WIDTH = 1320;
const HEIGHT = 1600;
const SCALE = 2;
const SETTLE_MS = 3500;
const LAYOUT_MS = 1200;
const WEBSITE = process.argv[2] ?? 'http://localhost:1499';

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
    CHROME,
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
  const send = await connect({ port });
  const close = () => {
    chrome.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  };
  return { send, close };
};

const composeHero = ({ width, tileRing }) => {
  document.querySelector('#iubenda-cs-banner')?.remove();
  const style = document.createElement('style');
  style.textContent = `
    html, body { background: transparent !important }
    .fidelityView { display: block !important; min-height: 0 !important; padding: 0 !important; background: transparent !important }
    #readmeHero { width: ${width}px; padding: 56px 60px 64px; display: flex; flex-direction: column; align-items: center }
    #readmeHero .lockup { display: flex; align-items: center; gap: 14px }
    #readmeHero .tile { width: 52px; height: 52px; border-radius: 14.5px; background: var(--brand-tile); box-shadow: inset 0 0 0 1.5px ${tileRing}; display: grid; place-items: center }
    #readmeHero .mascot { display: block; width: 39.5px; height: 39.5px; background: #fff; -webkit-mask: url(/src/assets/mascot.png) no-repeat center / contain }
    #readmeHero .name { font-size: 34px; font-weight: 600; letter-spacing: -0.015em; color: var(--t1) }
    #readmeHero .pill { margin-left: 6px; padding: 6px 12px; border-radius: 999px; font-size: 14px; font-weight: 500; letter-spacing: 0.01em; color: var(--t2); box-shadow: inset 0 0 0 1px var(--line-strong) }
    #readmeHero h1 { margin: 34px 0 44px; font-size: 76px; font-weight: 500; line-height: 1.04; letter-spacing: -0.025em; color: var(--t1); text-align: center }
    #readmeHero h1 em { font-style: normal; color: var(--accent) }
    #readmeHero .mockStage { width: ${width - 120}px }
  `;
  document.head.append(style);
  const hero = document.createElement('div');
  hero.id = 'readmeHero';
  hero.innerHTML =
    '<div class="lockup"><span class="tile"><i class="mascot"></i></span><span class="name">Goodboy</span><span class="pill">Free desktop ADE, built in public</span></div><h1>Stop <em>re‑explaining</em> yourself</h1>';
  hero.append(document.querySelector('.mockStage'));
  document.querySelector('.fidelityView').replaceChildren(hero);
};

const shoot = async ({ theme, workDirectory }) => {
  const { send, close } = await openBrowser();
  try {
    await send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: SCALE,
      mobile: false,
    });
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'prefers-color-scheme', value: theme },
      ],
    });
    await send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 },
    });
    await send('Page.enable');
    await send('Page.navigate', { url: `${WEBSITE}/?fidelity=SessionMock&theme=${theme}` });
    await pause(SETTLE_MS);
    const argument = {
      width: WIDTH,
      tileRing: theme === 'dark' ? 'rgb(255 255 255 / 0.12)' : 'transparent',
    };
    await send('Runtime.evaluate', {
      expression: `(${composeHero.toString()})(${JSON.stringify(argument)})`,
    });
    await pause(LAYOUT_MS);
    const measured = await send('Runtime.evaluate', {
      expression: 'JSON.stringify(document.querySelector("#readmeHero").getBoundingClientRect())',
      returnByValue: true,
    });
    const box = JSON.parse(measured.result.result.value);
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: box.y, width: box.width, height: box.height, scale: 1 },
    });
    if (!shot.result?.data) {
      throw new Error(`capture failed ${JSON.stringify(shot.error ?? {})}`);
    }
    const pngPath = join(workDirectory, `${theme}.png`);
    writeFileSync(pngPath, Buffer.from(shot.result.data, 'base64'));
    const outPath = join(OUT_DIRECTORY, `readme-hero-${theme}.webp`);
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
    return { outPath, pixels: `${box.width * SCALE}x${Math.round(box.height * SCALE)}` };
  } finally {
    close();
  }
};

const workDirectory = mkdtempSync(join(tmpdir(), 'readme-hero-png-'));
try {
  for (const theme of THEMES) {
    const { outPath, pixels } = await shoot({ theme, workDirectory });
    console.log(`wrote ${outPath} (${pixels})`);
  }
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
}
