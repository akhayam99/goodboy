#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { formatReport, launchOf, summarize } from './lib/bootTiming.mjs';

const POLL_MS = 250;
const MARKS_GRACE_MS = 13_000;
const USAGE =
  'usage: node scripts/boot-timing.mjs --app <binary or .app> --db <fixture.db> [--runs 10] [--timeout 60000] [--log <path>] [--label <name>]';

const optionOf = ({ argv, name, fallback }) => {
  const index = argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    return fallback;
  }
  return value;
};

const binaryOf = ({ app }) => {
  if (!app.endsWith('.app')) {
    return app;
  }
  const macos = join(app, 'Contents', 'MacOS');
  const [first] = readdirSync(macos);
  if (first === undefined) {
    throw new Error(`no binary in ${macos}`);
  }
  return join(macos, first);
};

const linesOf = ({ log }) => (existsSync(log) ? readFileSync(log, 'utf8').split('\n') : []);

const sleep = ({ ms }) => new Promise((done) => setTimeout(done, ms));

const exited = ({ child }) =>
  new Promise((done) => {
    if (child.exitCode !== null) {
      done();
      return;
    }
    child.once('exit', () => done());
  });

const launchOnce = async ({ binary, db, log, timeoutMs }) => {
  const workDir = mkdtempSync(join(tmpdir(), 'goodboy-boot-timing-'));
  const dbCopy = join(workDir, 'fixture.db');
  copyFileSync(db, dbCopy);
  const child = spawn(binary, [], {
    env: { ...process.env, GOODBOY_DB_FILE: dbCopy },
    stdio: 'ignore',
  });
  const deadline = Date.now() + timeoutMs;
  let launch = null;
  let readyAt = null;
  while (Date.now() < deadline) {
    await sleep({ ms: POLL_MS });
    launch = launchOf({ lines: linesOf({ log }), pid: child.pid });
    if (launch === null) {
      continue;
    }
    readyAt = readyAt ?? Date.now();
    if (launch.hasMarks || Date.now() - readyAt > MARKS_GRACE_MS) {
      break;
    }
  }
  child.kill('SIGTERM');
  await Promise.race([exited({ child }), sleep({ ms: 5000 })]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
  rmSync(workDir, { recursive: true, force: true });
  return launch;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const app = optionOf({ argv, name: 'app', fallback: undefined });
  const db = optionOf({ argv, name: 'db', fallback: undefined });
  if (app === undefined || db === undefined) {
    throw new Error(USAGE);
  }
  const runs = Number(optionOf({ argv, name: 'runs', fallback: '10' }));
  const timeoutMs = Number(optionOf({ argv, name: 'timeout', fallback: '60000' }));
  const log = optionOf({
    argv,
    name: 'log',
    fallback: join(homedir(), '.goodboy', 'boot-breadcrumbs.log'),
  });
  const label = optionOf({ argv, name: 'label', fallback: basename(app) });
  const dbPath = resolve(db);
  if (!existsSync(dbPath) || !statSync(dbPath).isFile()) {
    throw new Error(`the fixture does not exist: ${dbPath}`);
  }
  const binary = binaryOf({ app: resolve(app) });
  const launches = [];
  for (let run = 0; run < runs; run += 1) {
    const launch = await launchOnce({ binary, db: dbPath, log, timeoutMs });
    if (launch === null) {
      process.stderr.write(`run ${run + 1}: no ready line within ${timeoutMs} ms\n`);
      continue;
    }
    launches.push(launch);
  }
  if (launches.length === 0) {
    throw new Error('no launch reported a ready line');
  }
  process.stdout.write(`${formatReport({ label, summary: summarize({ launches }) })}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
