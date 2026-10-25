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

export class SceneNotReadyError extends Error {
  constructor({ scene }) {
    super(`scene ${scene}: did not become ready`);
    this.name = 'SceneNotReadyError';
    this.scene = scene;
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

export const summaryLine = ({ scenes, crash = null }) => {
  if (scenes.length > 0) return `scene measures: failed in ${scenes.join(', ')}`;
  return crash === null ? 'scene measures: ok' : 'scene measures: crashed';
};

export const failureLines = ({ failures }) =>
  failures.map(
    ({ scene, check, ...details }) => `failure ${scene}: ${check} ${JSON.stringify(details)}`,
  );

export const unmeasuredFailures = ({ scene, width, subject, count }) => {
  if (count > 0) return [];
  return [{ scene, ...(width === undefined ? {} : { width }), check: `measured 0 ${subject}` }];
};

export const timeCellFailures = ({ scene, width, times }) => [
  ...unmeasuredFailures({ scene, width, subject: 'time cells', count: times.measured }),
  ...(times.clipped.length > 0
    ? [{ scene, width, check: 'time wider than its column', clipped: times.clipped }]
    : []),
];

export const inboxAgeFailures = ({ width, ages }) => [
  ...unmeasuredFailures({ scene: 'inbox', width, subject: 'task ages', count: ages.measured }),
  ...(ages.wrapped.length > 0
    ? [{ scene: 'inbox', width, check: 'task age wraps', wrapped: ages.wrapped }]
    : []),
];

export const notReadyFailure = ({ error }) => ({
  scene: error.scene,
  check: 'scene did not become ready',
});

const escapeAnnotationData = (text) =>
  text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const escapeAnnotationProperty = (text) =>
  escapeAnnotationData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

export const ANNOTATION_LIMIT = 10;

export const annotationLines = ({ failures, crash = null, limit = ANNOTATION_LIMIT }) => {
  const lines = failures.slice(0, limit).map(({ scene, check, ...details }) => {
    const title = escapeAnnotationProperty(`scene measures: ${scene}`);
    return `::error title=${title}::${escapeAnnotationData(`${check} ${JSON.stringify(details)}`)}`;
  });
  if (failures.length > limit) {
    lines.push(
      `::error title=scene measures::${failures.length - limit} more failures, see the run summary`,
    );
  }
  if (crash !== null) {
    lines.push(
      `::error title=scene measures crashed::${escapeAnnotationData(String(crash.message ?? crash))}`,
    );
  }
  return lines;
};

export const summaryMarkdown = ({ scenes, crash = null, durationMs }) => {
  const seconds = Math.round(durationMs / 1000);
  const lines = [summaryLine({ scenes, crash }), '', `duration: ${seconds}s`];
  if (scenes.length > 0) {
    lines.push('', 'failing scenes:', ...scenes.map((scene) => `- ${scene}`));
  }
  if (crash !== null) {
    lines.push('', `crash: ${String(crash.message ?? crash)}`);
  }
  return `${lines.join('\n')}\n`;
};
