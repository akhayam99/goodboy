import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sleep } from './sleep.mjs';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const CHROME_START_TIMEOUT_MS = 30000;
const CHROME_POLL_MS = 100;
const CHROME_TARGET_READ_MS = 1000;
const CHROME_LAUNCH_ATTEMPTS = 3;
const CHROME_STDERR_TAIL_LINES = 20;

const readDebugPort = ({ profile }) => {
  try {
    const port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
};

const readTargets = async ({ port, deadline }) => {
  const timeoutMs = Math.min(CHROME_TARGET_READ_MS, deadline - Date.now());
  if (timeoutMs <= 0) {
    return null;
  }
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return await response.json();
  } catch {
    return null;
  }
};

const startChrome = async () => {
  const profile = mkdtempSync(join(tmpdir(), 'goodboy-check-page-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      ...(process.env.CI === undefined ? [] : ['--no-sandbox']),
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderr = '';
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk).split('\n').slice(-CHROME_STDERR_TAIL_LINES).join('\n');
  });
  let exit = null;
  chrome.on('exit', (code, signal) => {
    exit = `code ${code ?? 'none'}, signal ${signal ?? 'none'}`;
  });
  chrome.on('error', (error) => {
    exit = error.message;
  });
  const close = () => {
    chrome.stderr.destroy();
    chrome.kill('SIGKILL');
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      console.warn(`check-page: could not remove ${profile}`);
    }
  };
  const deadline = Date.now() + CHROME_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exit !== null) {
      close();
      throw new Error(`Chrome exited before it opened a debugging port (${exit})\n${stderr}`);
    }
    const port = readDebugPort({ profile });
    const targets = port === null ? null : await readTargets({ port, deadline });
    const page = targets?.find((target) => target.type === 'page');
    if (page !== undefined) {
      return { close, socketUrl: page.webSocketDebuggerUrl };
    }
    await sleep(CHROME_POLL_MS);
  }
  close();
  throw new Error(
    `Chrome did not open a debugging port in ${CHROME_START_TIMEOUT_MS} ms\n${stderr}`,
  );
};

export const launchChrome = async () => {
  const errors = [];
  for (let attempt = 1; attempt <= CHROME_LAUNCH_ATTEMPTS; attempt += 1) {
    try {
      return await startChrome();
    } catch (error) {
      errors.push(`attempt ${attempt}: ${error.message}`);
      console.warn(`check-page: Chrome launch attempt ${attempt} failed\n${error.message}`);
    }
  }
  throw new Error(
    `Chrome did not start after ${CHROME_LAUNCH_ATTEMPTS} attempts\n${errors.join('\n')}`,
  );
};
