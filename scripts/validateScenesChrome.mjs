import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CALL_TIMEOUT_MS,
  DevToolsTimeoutError,
  appendStderrTail,
  readDevToolsPort,
  startWithRetries,
  withChromeStderr,
} from './validateScenesBrowser.mjs';

const CHROME =
  process.env.VALIDATE_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CLOSE_GRACE_MS = 5_000;

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

const startChrome = async () => {
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
    { stdio: ['ignore', 'ignore', 'pipe'], detached: true },
  );
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr = appendStderrTail({ tail: stderr, chunk });
  });
  let hasExited = false;
  const exited = new Promise((resolvePromise) => {
    child.once('exit', (...result) => {
      hasExited = true;
      resolvePromise(result);
    });
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
    child.stderr.destroy();
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      console.warn(`validate-scenes: could not remove ${profile}`);
    }
  };
  try {
    const port = await readDevToolsPort({ profile, hasExited: () => hasExited });
    const connection = await connect(port);
    disconnect = connection.disconnect;
    return { send: connection.send, close };
  } catch (error) {
    await close();
    throw withChromeStderr({ error, stderr });
  }
};

export const browser = () => startWithRetries({ start: startChrome });
