import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_OUT = resolve(tmpdir(), 'goodboy-fidelity-shots');
const PAIRS = [
  ['session', 'workflow-run', 'SessionMock', '.mockStage'],
  ['handoff', 'context-drawer', 'HandoffMock', '.mockStage'],
  ['inbox', 'inbox', 'InboxMock', '.mockStage'],
  ['workflow', 'workflow', 'WorkflowRunMock', '.mockStage'],
  ['diff', 'brand-diff', 'DiffReviewMock', '.mockStage'],
  ['board', 'board', 'BoardMock', '.mockStage'],
  ['storage', 'brand-storage', 'StorageMock', '.mockStage'],
  ['ask', 'brand-context', 'AskCodeMock', '.mockStage'],
];
const THEMES = ['dark', 'light'];
const SIZES = [
  [1440, 1100],
  [390, 844],
];

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((value, index, values) => [value.replace(/^--/, ''), values[index + 1]])
    .filter(([key]) => key),
);
const out = resolve(args.out ?? DEFAULT_OUT);
const website = args.website ?? 'http://localhost:1499';
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

const browser = async (width, height) => {
  const port = 9700 + Math.floor(Math.random() * 200);
  const profile = mkdtempSync(join(tmpdir(), 'fidelity-shots-'));
  const process = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const send = await connect(port);
  const close = () => {
    process.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, close };
};

const evaluate = async (send, expression, argument) => {
  const document = await send('Runtime.evaluate', { expression: 'document' });
  const result = await send('Runtime.callFunctionOn', {
    objectId: document.result.result.objectId,
    functionDeclaration: expression,
    arguments: [{ value: argument }],
    returnByValue: true,
  });
  return result.result?.result?.value;
};

const measure = function ({ selector }) {
  const elements = [...this.querySelectorAll(selector)];
  return elements.map((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      radius: style.borderRadius,
      padding: style.padding,
      color: style.color,
      background: style.backgroundColor,
      border: style.borderColor,
    };
  });
};

const capture = async ({ send, url, selector, width, height }) => {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 520,
  });
  await send('Page.enable');
  await send('Page.navigate', { url });
  await pause(wait);
  const values = await evaluate(send, measure, { selector });
  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width, height, scale: 2 },
  });
  return { values, png: Buffer.from(screenshot.result.data, 'base64') };
};

const main = async () => {
  mkdirSync(out, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), pairs: [] };
  for (const [name, scene, mock, selector] of PAIRS) {
    for (const theme of THEMES) {
      for (const [width, height] of SIZES) {
        const session = await browser(width, height);
        try {
          const mockResult = await capture({
            send: session.send,
            url: `${website}/?fidelity=${mock}&theme=${theme}`,
            selector,
            width,
            height,
          });
          const realResult = await capture({
            send: session.send,
            url: `${app}/?scene=${scene}&theme=${theme}`,
            selector: '#root',
            width,
            height,
          });
          const key = `${name}-${theme}-${width}`;
          writeFileSync(join(out, `${key}-mock.png`), mockResult.png);
          writeFileSync(join(out, `${key}-real.png`), realResult.png);
          report.pairs.push({
            key,
            mock,
            scene,
            width,
            height,
            theme,
            mockMeasurements: mockResult.values,
            realMeasurements: realResult.values,
            bytes: [
              statSync(join(out, `${key}-mock.png`)).size,
              statSync(join(out, `${key}-real.png`)).size,
            ],
          });
        } finally {
          session.close();
        }
      }
    }
  }
  writeFileSync(join(out, 'fidelity.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`fidelity shots written to ${out}`);
};

main().catch((error) => {
  console.error(`fidelity-shots: ${error.message}`);
  process.exitCode = 1;
});
