import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CALL_TIMEOUT_MS = 60_000;
export const WARM_UP_TIMEOUT_MS = 90_000;
export const PORT_FILE_TIMEOUT_MS = 10_000;

const PORT_FILE_POLL_MS = 100;

export class DevToolsTimeoutError extends Error {
  constructor({ method, timeoutMs }) {
    super(`${method} timed out after ${Math.round(timeoutMs / 1000)}s`);
    this.name = 'DevToolsTimeoutError';
    this.method = method;
    this.timeoutMs = timeoutMs;
  }
}

const defaultPause = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const tryRead = ({ read, path }) => {
  try {
    return read(path);
  } catch {
    return '';
  }
};

export const parseDevToolsPort = ({ text }) => {
  const port = Number(text.split('\n')[0]?.trim());
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
};

export const readDevToolsPort = async ({
  profile,
  timeoutMs = PORT_FILE_TIMEOUT_MS,
  pause = defaultPause,
  read = (path) => readFileSync(path, 'utf8'),
}) => {
  const path = join(profile, 'DevToolsActivePort');
  const attempts = Math.max(1, Math.ceil(timeoutMs / PORT_FILE_POLL_MS));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const port = parseDevToolsPort({ text: tryRead({ read, path }) });
    if (port !== null) return port;
    await pause(PORT_FILE_POLL_MS);
  }
  throw new Error(`Chrome did not write DevToolsActivePort in ${Math.round(timeoutMs / 1000)}s`);
};

export const measureScene = async ({ scene, task, attempts = 2 }) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (!(error instanceof DevToolsTimeoutError)) throw error;
      if (attempt === attempts) throw new Error(`scene ${scene}: ${error.message}`);
    }
  }
  return undefined;
};

export const failingScenes = ({ failures, error }) => {
  const scenes = new Set(failures.map((failure) => failure.scene));
  const named = /scene ([^\s:]+):/.exec(error?.message ?? '');
  if (named !== null) scenes.add(named[1]);
  return [...scenes];
};

export const summaryLine = ({ scenes }) =>
  scenes.length === 0 ? 'scene measures: ok' : `scene measures: failed in ${scenes.join(', ')}`;
